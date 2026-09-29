import { JSON_DOCUMENT_COLUMN_NAME } from '../mysql-constants'
import { OperatorHandler, OperatorContext, OperatorResult } from './types'

/**
 * Handler for array operators: $in, $nin
 */
export class ArrayOperatorHandler implements OperatorHandler {
  readonly operators = ['$in', '$nin']

  async handle(
    operator: string,
    key: string,
    operand: any,
    context: OperatorContext
  ): Promise<OperatorResult> {
    if (!Array.isArray(operand)) {
      throw new Error(`Operand for ${operator} must be an array`)
    }

    const sanitizedKey = context.sanitizeKey(key)
    const jsonPathExpression = `${context.jsonColumnName}->>'$.${sanitizedKey}'`

    // Handle null values in the array
    const nullCount = operand.filter((v) => v === null).length
    const nonNullValues = operand.filter((v) => v !== null)

    const conditionParts: string[] = []
    const params: any[] = []

    if (nonNullValues.length > 0) {
      const placeholders = nonNullValues.map(() => '?').join(', ')
      conditionParts.push(`${jsonPathExpression} IN (${placeholders})`)
      nonNullValues.forEach((value) => {
        params.push(context.convertValue(value))
      })
    }

    if (nullCount > 0) {
      // Use JSON_TYPE to check for NULL because ->> returns string "null" not SQL NULL
      conditionParts.push(
        `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}')) = 'NULL'`
      )
    }

    // An empty operand array matches nothing for $in, and everything for $nin
    const inCondition =
      conditionParts.length === 0
        ? '1=0'
        : conditionParts.length === 1
          ? conditionParts[0]
          : `(${conditionParts.join(' OR ')})`

    const condition = operator === '$nin' ? `NOT (${inCondition})` : inCondition

    return { condition, params }
  }
}
