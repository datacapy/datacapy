import { QuerySelection } from '../interface'
import {
  JSON_DOCUMENT_COLUMN_NAME,
  GENERATED_COLUMN_PREFIX,
} from './mysql-constants'
import {
  convertValue,
  formatNestedColumnName,
  jsonExtract,
  jsonUnquote,
} from './mysql-sql-utils'

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
    const isDateOperand = operand instanceof Date
    const jsonPathExpression = `${JSON_DOCUMENT_COLUMN_NAME}->>'$.${key}'`

    if (isDateOperand) {
      // Check if a generated column exists for this field
      const generatedColumn = await this.getGeneratedColumnName(key)

      if (generatedColumn) {
        // Use the generated column directly for optimal index usage
        return `\`${generatedColumn}\` ${operator} ?`
      } else {
        // Fallback to CAST for proper date comparison
        const castExpression =
          `CAST(JSON_UNQUOTE(JSON_EXTRACT(` +
          `${JSON_DOCUMENT_COLUMN_NAME}, ` +
          `'$.${key}'` +
          `)) AS DATETIME)`
        return `${castExpression} ${operator} ?`
      }
    } else {
      // For non-date operands, check if there's a generated column anyway
      const generatedColumn = await this.getGeneratedColumnName(key)

      if (generatedColumn) {
        // Use the generated column for better performance
        return `\`${generatedColumn}\` ${operator} ?`
      } else {
        // Use regular JSON path for non-date comparisons
        return `${jsonPathExpression} ${operator} ?`
      }
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

    for (let [key, value] of Object.entries(query)) {
      if (key === '$and' || key === '$or' || key === '$nor') {
        if (Array.isArray(value)) {
          const subClauses = await Promise.all(
            value.map(async (subQuery) => {
              const { clause, params: subParams } =
                await this.buildWhereClause(subQuery)
              params.push(...subParams)
              return clause
            })
          )
          let operator = key === '$and' ? ' AND ' : ' OR '
          let finalClause = `(${subClauses.join(operator)})`

          if (key === '$nor') {
            finalClause = `NOT ${finalClause}`
          }

          conditions.push(finalClause)
        }
      } else if (key === '$not') {
        const { clause, params: subParams } = await this.buildWhereClause(value)
        params.push(...subParams)
        conditions.push(`NOT (${clause})`)
      } else {
        const jsonPathExpression = `${JSON_DOCUMENT_COLUMN_NAME}->>'$.${key}'`

        if (typeof value === 'object' && value !== null) {
          for (let [operator, operand] of Object.entries(value)) {
            switch (operator) {
              case '$eq':
                if (operand === null) {
                  // Use JSON_TYPE to check for NULL because ->> returns string "null" not SQL NULL
                  const condition = `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${key}')) = 'NULL'`
                  conditions.push(condition)
                } else if (typeof operand === 'boolean') {
                  // Handle boolean values - use JSON_EXTRACT to compare as JSON boolean
                  conditions.push(
                    `JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${key}') = ?`
                  )
                  params.push(operand)
                } else {
                  conditions.push(
                    await this.buildTypeAwareCondition(key, '=', operand)
                  )
                  params.push(convertValue(operand))
                }
                break
              case '$ne':
                if (operand === null) {
                  conditions.push(`${jsonPathExpression} IS NOT NULL`)
                } else if (typeof operand === 'boolean') {
                  // Handle boolean values - use JSON_EXTRACT to compare as JSON boolean
                  conditions.push(
                    `JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${key}') != ?`
                  )
                  params.push(operand)
                } else {
                  conditions.push(
                    await this.buildTypeAwareCondition(key, '!=', operand)
                  )
                  params.push(convertValue(operand))
                }
                break
              case '$gt':
                conditions.push(
                  await this.buildTypeAwareCondition(key, '>', operand)
                )
                params.push(convertValue(operand))
                break
              case '$gte':
                conditions.push(
                  await this.buildTypeAwareCondition(key, '>=', operand)
                )
                params.push(convertValue(operand))
                break
              case '$lt':
                conditions.push(
                  await this.buildTypeAwareCondition(key, '<', operand)
                )
                params.push(convertValue(operand))
                break
              case '$lte':
                conditions.push(
                  await this.buildTypeAwareCondition(key, '<=', operand)
                )
                params.push(convertValue(operand))
                break
              case '$in':
                if (Array.isArray(operand)) {
                  // Handle null values in the array
                  const nullCount = operand.filter((v) => v === null).length
                  const nonNullValues = operand.filter((v) => v !== null)

                  const conditions_parts: string[] = []

                  if (nonNullValues.length > 0) {
                    let placeholders = nonNullValues.map((_p) => '?').join(', ')
                    conditions_parts.push(
                      `${jsonPathExpression} IN (${placeholders})`
                    )
                    nonNullValues.forEach((value) => {
                      params.push(convertValue(value))
                    })
                  }

                  if (nullCount > 0) {
                    // Use JSON_TYPE to check for NULL because ->> returns string "null" not SQL NULL
                    conditions_parts.push(
                      `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${key}')) = 'NULL'`
                    )
                  }

                  if (conditions_parts.length === 1) {
                    conditions.push(conditions_parts[0])
                  } else {
                    conditions.push(`(${conditions_parts.join(' OR ')})`)
                  }
                } else {
                  throw new Error(`Operand for $in must be an array`)
                }
                break
              case '$like':
                conditions.push(`${jsonPathExpression} LIKE ?`)
                params.push(convertValue(operand))
                break
              case '$regex': {
                // Handle MongoDB-style $regex operator
                // Get $options from sibling key if present
                const options = (value as Record<string, any>).$options || ''
                let pattern: string

                if (typeof operand === 'string') {
                  pattern = operand
                } else if (operand instanceof RegExp) {
                  // Convert RegExp to string pattern
                  // Note: MySQL REGEXP doesn't support all JS regex flags
                  pattern = operand.source
                  if (operand.ignoreCase) {
                    // MySQL 8.0+ supports case-insensitive with (?i) prefix
                    pattern = `(?i)${pattern}`
                  }
                } else {
                  throw new Error(
                    `Invalid operand for $regex: ${typeof operand}`
                  )
                }

                // Apply case-insensitive option from sibling $options
                if (
                  typeof options === 'string' &&
                  options.includes('i') &&
                  !pattern.startsWith('(?i)')
                ) {
                  pattern = `(?i)${pattern}`
                }

                conditions.push(`${jsonPathExpression} REGEXP ?`)
                params.push(pattern)
                break
              }
              case '$options':
                // Skip $options as it's handled with $regex
                break
              case '$exists':
                if (typeof operand === 'boolean') {
                  if (operand) {
                    // Field must exist
                    conditions.push(
                      `JSON_CONTAINS_PATH(${JSON_DOCUMENT_COLUMN_NAME}, 'one', '$.${key}')`
                    )
                  } else {
                    // Field must not exist
                    conditions.push(
                      `NOT JSON_CONTAINS_PATH(${JSON_DOCUMENT_COLUMN_NAME}, 'one', '$.${key}')`
                    )
                  }
                } else {
                  throw new Error(`Operand for $exists must be a boolean`)
                }
                break
            }
          }
        } else {
          if (value === null) {
            // Use JSON_TYPE to check for NULL because ->> returns string "null" not SQL NULL
            const condition = `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${key}')) = 'NULL'`
            conditions.push(condition)
          } else if (typeof value === 'boolean') {
            // Handle boolean values - use JSON_EXTRACT to compare as JSON boolean
            conditions.push(
              `JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${key}') = ?`
            )
            params.push(value)
          } else {
            conditions.push(await this.buildTypeAwareCondition(key, '=', value))
            params.push(convertValue(value))
          }
        }
      }
    }

    return {
      clause: conditions.join(' AND '),
      params,
    }
  }
}
