import { QuerySelection } from '../../interface'
import { LogicalOperatorHandler, OperatorContext, OperatorResult } from './types'

/**
 * Handler for logical operators: $and, $or, $nor, $not
 */
export class LogicalOperatorsHandler implements LogicalOperatorHandler {
  readonly operators = ['$and', '$or', '$nor', '$not']

  async handle(
    operator: string,
    value: QuerySelection[] | QuerySelection,
    context: OperatorContext
  ): Promise<OperatorResult> {
    switch (operator) {
      case '$and':
      case '$or':
      case '$nor':
        return this.handleArrayLogical(
          operator,
          value as QuerySelection[],
          context
        )
      case '$not':
        return this.handleNot(value as QuerySelection, context)
      default:
        throw new Error(`Unknown logical operator: ${operator}`)
    }
  }

  private async handleArrayLogical(
    operator: string,
    queries: QuerySelection[],
    context: OperatorContext
  ): Promise<OperatorResult> {
    if (!Array.isArray(queries)) {
      throw new Error(`Operand for ${operator} must be an array`)
    }

    // Process all sub-queries in parallel, preserving order
    const results = await Promise.all(
      queries.map(async (subQuery) => context.buildWhereClause(subQuery))
    )

    // Extract clauses and params in input order (matches clause placeholder order)
    const subClauses = results.map((r) => r.clause)
    const params = results.flatMap((r) => r.params)

    const joinOperator = operator === '$and' ? ' AND ' : ' OR '
    let finalClause = `(${subClauses.join(joinOperator)})`

    if (operator === '$nor') {
      finalClause = `NOT ${finalClause}`
    }

    return { condition: finalClause, params }
  }

  private async handleNot(
    query: QuerySelection,
    context: OperatorContext
  ): Promise<OperatorResult> {
    const { clause, params } = await context.buildWhereClause(query)
    return { condition: `NOT (${clause})`, params }
  }
}
