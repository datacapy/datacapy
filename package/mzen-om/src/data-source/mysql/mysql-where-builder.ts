import { QuerySelection } from '../interface'
import {
  JSON_DOCUMENT_COLUMN_NAME,
  GENERATED_COLUMN_PREFIX,
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
        // Fallback to CAST for proper date comparison
        const castExpression =
          `CAST(JSON_UNQUOTE(JSON_EXTRACT(` +
          `${JSON_DOCUMENT_COLUMN_NAME}, ` +
          `'$.${sanitizedKey}'` +
          `)) AS DATETIME)`
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
      } else {
        // Use regular JSON path for non-date comparisons
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

          if (handler) {
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
