import { JSON_DOCUMENT_COLUMN_NAME } from '../mysql-constants'
import { OperatorHandler, OperatorContext, OperatorResult } from './types'

/**
 * Handler for array operators: $in
 */
export class ArrayOperatorHandler implements OperatorHandler {
  readonly operators = ['$in']

  async handle(
    operator: string,
    key: string,
    operand: any,
    context: OperatorContext
  ): Promise<OperatorResult> {
    if (!Array.isArray(operand)) {
      throw new Error('Operand for $in must be an array')
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

    const condition =
      conditionParts.length === 1
        ? conditionParts[0]
        : `(${conditionParts.join(' OR ')})`

    return { condition, params }
  }
}
