import { JSON_DOCUMENT_COLUMN_NAME } from '../mysql-constants'
import { OperatorHandler, OperatorContext, OperatorResult } from './types'

/**
 * Handler for comparison operators: $eq, $ne, $gt, $gte, $lt, $lte
 */
export class ComparisonOperatorHandler implements OperatorHandler {
  readonly operators = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte']

  private readonly sqlOperatorMap: Record<string, string> = {
    $eq: '=',
    $ne: '!=',
    $gt: '>',
    $gte: '>=',
    $lt: '<',
    $lte: '<=',
  }

  async handle(
    operator: string,
    key: string,
    operand: any,
    context: OperatorContext
  ): Promise<OperatorResult> {
    const sanitizedKey = context.sanitizeKey(key)

    // Handle null values specially for $eq and $ne
    if (operand === null) {
      return this.handleNullComparison(operator, sanitizedKey)
    }

    // Handle boolean values specially for $eq and $ne
    if (typeof operand === 'boolean') {
      return this.handleBooleanComparison(operator, sanitizedKey, operand)
    }

    // Standard comparison using type-aware condition
    const sqlOperator = this.sqlOperatorMap[operator]
    const condition = await context.buildTypeAwareCondition(
      key,
      sqlOperator,
      operand
    )

    return {
      condition,
      params: [context.convertValue(operand)],
    }
  }

  private handleNullComparison(
    operator: string,
    sanitizedKey: string
  ): OperatorResult {
    // Use JSON_TYPE to check for NULL because ->> returns string "null" not SQL NULL
    const jsonTypeCheck = `JSON_TYPE(JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}'))`

    if (operator === '$eq') {
      return { condition: `${jsonTypeCheck} = 'NULL'`, params: [] }
    } else if (operator === '$ne') {
      return { condition: `${jsonTypeCheck} != 'NULL'`, params: [] }
    }

    throw new Error(`Operator ${operator} not supported with null values`)
  }

  private handleBooleanComparison(
    operator: string,
    sanitizedKey: string,
    operand: boolean
  ): OperatorResult {
    // Handle boolean values - use JSON_EXTRACT to compare as JSON boolean
    const jsonExtract = `JSON_EXTRACT(${JSON_DOCUMENT_COLUMN_NAME}, '$.${sanitizedKey}')`
    const sqlOperator = operator === '$eq' ? '=' : '!='

    return {
      condition: `${jsonExtract} ${sqlOperator} ?`,
      params: [operand],
    }
  }
}
