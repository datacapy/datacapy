import { OperatorHandler, LogicalOperatorHandler } from './types'
import { LogicalOperatorsHandler } from './logical-operator-handler'
import { ComparisonOperatorHandler } from './comparison-operator-handler'
import { ArrayOperatorHandler } from './array-operator-handler'
import { StringOperatorHandler } from './string-operator-handler'
import { ExistenceOperatorHandler } from './existence-operator-handler'

/**
 * Registry for operator handlers.
 * Maps operator names to their handler instances.
 */
export class OperatorRegistry {
  private selectionHandlers = new Map<string, OperatorHandler>()
  private logicalHandler: LogicalOperatorHandler

  constructor() {
    // Register logical operators handler
    this.logicalHandler = new LogicalOperatorsHandler()

    // Register selection operator handlers
    this.registerHandler(new ComparisonOperatorHandler())
    this.registerHandler(new ArrayOperatorHandler())
    this.registerHandler(new StringOperatorHandler())
    this.registerHandler(new ExistenceOperatorHandler())
  }

  private registerHandler(handler: OperatorHandler): void {
    for (const operator of handler.operators) {
      this.selectionHandlers.set(operator, handler)
    }
  }

  /**
   * Gets the handler for a selection operator (field-level operators like $eq, $gt, etc.)
   */
  getSelectionHandler(operator: string): OperatorHandler | undefined {
    return this.selectionHandlers.get(operator)
  }

  /**
   * Gets the logical operators handler
   */
  getLogicalHandler(): LogicalOperatorHandler {
    return this.logicalHandler
  }

  /**
   * Checks if the given key is a logical operator
   */
  isLogicalOperator(key: string): boolean {
    return this.logicalHandler.operators.includes(key)
  }

  /**
   * Checks if the given operator is a registered selection operator
   */
  isSelectionOperator(operator: string): boolean {
    return this.selectionHandlers.has(operator)
  }
}
