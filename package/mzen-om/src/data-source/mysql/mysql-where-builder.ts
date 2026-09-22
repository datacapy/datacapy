import { QuerySelection } from '../interface'
import {
  JSON_DOCUMENT_COLUMN_NAME,
  GENERATED_COLUMN_PREFIX,
  GENERATED_COLUMN_LOWERCASE_SUFFIX,
} from './mysql-constants'
import {
  convertValue,
  formatNestedColumnName,
  sanitizeIdentifier,
  sanitizeJsonPathKey,
  validateOperator,
} from './mysql-sql-utils'
import { OperatorRegistry, OperatorContext } from './mysql-where-operators'

// Re-export for backward compatibility
export { isSimpleLiteralPattern } from './mysql-where-operators'

/**
 * Column existence checker function type
 */
export type ColumnExistsChecker = (
  tableName: string,
  columnName: string
) => Promise<boolean>

/**
 * WHERE clause builder for MySQL JSON document queries
 */
export class MysqlWhereBuilder {
  private columnExistsChecker?: ColumnExistsChecker
  private tableName?: string
  private operatorRegistry = new OperatorRegistry()

  /**
   * Sets up the column existence checker for generated column optimization
   */
  setColumnExistsChecker(checker: ColumnExistsChecker, tableName: string) {
    this.columnExistsChecker = checker
    this.tableName = tableName
  }

  /**
   * Gets the generated column name if it exists, null otherwise
   */
  private async getGeneratedColumnName(field: string): Promise<string | null> {
    if (!this.columnExistsChecker || !this.tableName) {
      return null
    }

    const formattedField = formatNestedColumnName(field)
    const generatedColumnName = `${GENERATED_COLUMN_PREFIX}${formattedField}`

    try {
      const exists = await this.columnExistsChecker(
        this.tableName,
        generatedColumnName
      )
      return exists ? generatedColumnName : null
    } catch {
      return null
    }
  }

  /**
   * Gets the pre-lowercased generated column name for a field if one exists, null otherwise.
   * These columns store LOWER(field) and are used for efficient case-insensitive LIKE queries.
   */
  private async getLowercaseGeneratedColumnName(
    field: string
  ): Promise<string | null> {
    if (!this.columnExistsChecker || !this.tableName) {
      return null
    }

    const formattedField = formatNestedColumnName(field)
    const columnName = `${GENERATED_COLUMN_PREFIX}${formattedField}${GENERATED_COLUMN_LOWERCASE_SUFFIX}`

    try {
      const exists = await this.columnExistsChecker(this.tableName, columnName)
      return exists ? columnName : null
    } catch {
      return null
    }
  }

  /**
   * Builds a type-aware condition that uses generated columns when available
   */
  private async buildTypeAwareCondition(
    key: string,
    operator: string,
    operand: any
  ): Promise<string> {
    // Sanitize inputs to prevent SQL injection
    const sanitizedKey = sanitizeJsonPathKey(key)
    const sanitizedOperator = validateOperator(operator)

    const isDateOperand = operand instanceof Date
    const jsonPathExpression = `${JSON_DOCUMENT_COLUMN_NAME}->>'$.${sanitizedKey}'`

    if (isDateOperand) {
      // Check if a generated column exists for this field
      const generatedColumn = await this.getGeneratedColumnName(sanitizedKey)

      if (generatedColumn) {
        // Use the generated column directly for optimal index usage
        // Sanitize the generated column name as it contains user input
        const sanitizedColumnName = sanitizeIdentifier(generatedColumn)
        return `\`${sanitizedColumnName}\` ${sanitizedOperator} ?`
      } else {
        // JSON.stringify serializes Date objects as ISO 8601 (e.g. "2026-02-28T14:36:18.421Z").
        // MySQL's CAST(... AS DATETIME) cannot parse ISO 8601 format, so use STR_TO_DATE
        // with the first 19 characters (dropping milliseconds and Z suffix).
        const castExpression =
          `STR_TO_DATE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(` +
          `${JSON_DOCUMENT_COLUMN_NAME}, ` +
          `'$.${sanitizedKey}'` +
          `)), 19), '%Y-%m-%dT%H:%i:%s')`
        return `${castExpression} ${sanitizedOperator} ?`
      }
    } else {
      // For non-date operands, check if there's a generated column anyway
      const generatedColumn = await this.getGeneratedColumnName(sanitizedKey)

      if (generatedColumn) {
        // Use the generated column for better performance
        // Sanitize the generated column name as it contains user input
        const sanitizedColumnName = sanitizeIdentifier(generatedColumn)
        return `\`${sanitizedColumnName}\` ${sanitizedOperator} ?`
      } else if (typeof operand === 'number') {
        // ->> extracts JSON as text, so MySQL implicitly casts the stored side to
        // compare against a numeric parameter. A non-numeric stored value (e.g. JSON
        // null, which ->> renders as the literal text 'null') fails that cast with
        // "Truncated incorrect DOUBLE value" instead of simply not matching. Guard on
        // JSON_TYPE so a missing, null, or non-numeric field compares as SQL NULL (no
        // match) rather than raising an error.
        const jsonExtract = `JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}')`
        const numericExtract = `(CASE WHEN JSON_TYPE(${jsonExtract}) IN ('INTEGER', 'DOUBLE', 'DECIMAL') THEN ${jsonExtract} ELSE NULL END)`
        return `${numericExtract} ${sanitizedOperator} ?`
      } else {
        // Use regular JSON path for non-date, non-numeric comparisons
        return `${jsonPathExpression} ${sanitizedOperator} ?`
      }
    }
  }

  /**
   * Creates the operator context for handlers
   */
  private createContext(): OperatorContext {
    return {
      buildTypeAwareCondition: this.buildTypeAwareCondition.bind(this),
      buildWhereClause: this.buildWhereClause.bind(this),
      getLowercaseGeneratedColumnName:
        this.getLowercaseGeneratedColumnName.bind(this),
      jsonColumnName: JSON_DOCUMENT_COLUMN_NAME,
      sanitizeKey: sanitizeJsonPathKey,
      convertValue: convertValue,
    }
  }

  /**
   * Builds a WHERE clause from a query selection object
   */
  async buildWhereClause(query: QuerySelection): Promise<{
    clause: string
    params: any[]
  }> {
    const conditions: string[] = []
    const params: any[] = []
    const context = this.createContext()

    for (const [key, value] of Object.entries(query)) {
      // Handle logical operators at the top level
      if (this.operatorRegistry.isLogicalOperator(key)) {
        const handler = this.operatorRegistry.getLogicalHandler()
        const result = await handler.handle(key, value, context)
        conditions.push(result.condition)
        params.push(...result.params)
        continue
      }

      // Handle field-level queries
      const sanitizedKey = sanitizeJsonPathKey(key)

      if (typeof value === 'object' && value !== null) {
        // Object value means operators are specified
        for (const [operator, operand] of Object.entries(value)) {
          const handler = this.operatorRegistry.getSelectionHandler(operator)

          if (!handler) {
            // Fail closed: an unrecognised operator must never be silently
            // dropped from the query, since a query missing a condition is
            // not "no rows match" but "no WHERE clause for this field at
            // all" - potentially scoping a SELECT/UPDATE/DELETE far wider
            // than intended.
            throw new Error(`Invalid query operator: ${operator}`)
          }

          const result = await handler.handle(
            operator,
            key,
            operand,
            context,
            value // Pass all siblings for $options access
          )

          if (result) {
            conditions.push(result.condition)
            params.push(...result.params)
          }
        }
      } else {
        // Direct value - implicit $eq
        if (value === null) {
          // Use JSON_TYPE to check for NULL because ->> returns string "null" not SQL NULL
          conditions.push(
            `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}')) = 'NULL'`
          )
        } else if (typeof value === 'boolean') {
          // Handle boolean values - use JSON_EXTRACT to compare as JSON boolean
          conditions.push(
            `JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}') = ?`
          )
          params.push(value)
        } else {
          conditions.push(await this.buildTypeAwareCondition(key, '=', value))
          params.push(convertValue(value))
        }
      }
    }

    return {
      clause: conditions.join(' AND '),
      params,
    }
  }
}
