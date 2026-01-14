import { QuerySelection } from '../../interface'

/**
 * Result from an operator handler
 */
export interface OperatorResult {
  condition: string
  params: any[]
}

/**
 * Context object passed to all operator handlers.
 * Provides access to shared functionality and recursive building.
 */
export interface OperatorContext {
  /**
   * Builds a type-aware condition using generated columns when available
   */
  buildTypeAwareCondition(
    key: string,
    operator: string,
    operand: any
  ): Promise<string>

  /**
   * Recursively builds WHERE clause for nested queries (used by logical operators)
   */
  buildWhereClause(
    query: QuerySelection
  ): Promise<{ clause: string; params: any[] }>

  /**
   * JSON document column name constant
   */
  readonly jsonColumnName: string

  /**
   * Sanitizes a JSON path key for safe SQL inclusion
   */
  sanitizeKey(key: string): string

  /**
   * Converts value to MySQL-compatible format
   */
  convertValue(value: any): any
}

/**
 * Base interface for selection operator handlers ($eq, $gt, $in, etc.)
 */
export interface OperatorHandler {
  /**
   * List of operators this handler can process
   */
  readonly operators: string[]

  /**
   * Handles an operator, returning the SQL condition and parameters
   * @param operator The operator name (e.g., '$eq', '$gt')
   * @param key The field key being queried (unsanitized)
   * @param operand The value/operand for the operator
   * @param context Shared context with helper methods
   * @param siblingOperators Optional map of sibling operators (for $regex/$options relationship)
   * @returns OperatorResult or null if the operator should be skipped
   */
  handle(
    operator: string,
    key: string,
    operand: any,
    context: OperatorContext,
    siblingOperators?: Record<string, any>
  ): Promise<OperatorResult | null>
}

/**
 * Handler for logical operators that work with arrays of sub-queries
 */
export interface LogicalOperatorHandler {
  /**
   * List of logical operators this handler processes
   */
  readonly operators: string[]

  /**
   * Handles a logical operator
   * @param operator The operator name (e.g., '$and', '$or')
   * @param value The array of sub-queries or single sub-query
   * @param context Shared context with helper methods
   */
  handle(
    operator: string,
    value: QuerySelection[] | QuerySelection,
    context: OperatorContext
  ): Promise<OperatorResult>
}
