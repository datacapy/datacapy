import { JSON_DOCUMENT_COLUMN_NAME } from '../mysql-constants'
import { validateJsonType } from '../mysql-sql-utils'
import { OperatorHandler, OperatorContext, OperatorResult } from './types'

/**
 * Handler for existence and type checking operators: $exists, $type
 */
export class ExistenceOperatorHandler implements OperatorHandler {
  readonly operators = ['$exists', '$type']

  async handle(
    operator: string,
    key: string,
    operand: any,
    context: OperatorContext
  ): Promise<OperatorResult> {
    const sanitizedKey = context.sanitizeKey(key)

    if (operator === '$exists') {
      return this.handleExists(sanitizedKey, operand)
    }

    return this.handleType(sanitizedKey, operand)
  }

  private handleExists(sanitizedKey: string, operand: any): OperatorResult {
    if (typeof operand !== 'boolean') {
      throw new Error('Operand for $exists must be a boolean')
    }

    const containsPath = `JSON_CONTAINS_PATH(${JSON_DOCUMENT_COLUMN_NAME}, 'one', '$.${sanitizedKey}')`

    return {
      condition: operand ? containsPath : `NOT ${containsPath}`,
      params: [],
    }
  }

  private handleType(sanitizedKey: string, operand: any): OperatorResult {
    if (typeof operand !== 'string') {
      throw new Error('Operand for $type must be a string')
    }

    // Map MongoDB type names to MySQL JSON_TYPE values
    const typeMap: Record<string, string> = {
      date: 'DATETIME',
      string: 'STRING',
      number: 'INTEGER',
      double: 'DOUBLE',
      bool: 'BOOLEAN',
      boolean: 'BOOLEAN',
      array: 'ARRAY',
      object: 'OBJECT',
      null: 'NULL',
    }

    const mysqlType = typeMap[operand.toLowerCase()] || operand.toUpperCase()
    // Validate the type to prevent SQL injection
    const sanitizedType = validateJsonType(mysqlType)

    return {
      condition: `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}')) = '${sanitizedType}'`,
      params: [],
    }
  }
}
