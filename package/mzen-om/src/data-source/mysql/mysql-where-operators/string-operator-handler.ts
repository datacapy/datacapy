import { OperatorHandler, OperatorContext, OperatorResult } from './types'

/**
 * Regex metacharacters that indicate a pattern is not a simple literal string
 */
const REGEX_METACHARACTERS = /[.+*?^$|[\](){}\\]/

/**
 * Checks if a pattern is a simple literal string without regex metacharacters.
 * Simple literals can be optimized to use LIKE '%pattern%' instead of REGEXP.
 */
export function isSimpleLiteralPattern(pattern: string): boolean {
  return !REGEX_METACHARACTERS.test(pattern)
}

/**
 * Handler for string pattern operators: $like, $regex, $options
 */
export class StringOperatorHandler implements OperatorHandler {
  readonly operators = ['$like', '$regex', '$options']

  async handle(
    operator: string,
    key: string,
    operand: any,
    context: OperatorContext,
    siblingOperators?: Record<string, any>
  ): Promise<OperatorResult | null> {
    // Skip $options - it's handled together with $regex
    if (operator === '$options') {
      return null
    }

    const sanitizedKey = context.sanitizeKey(key)
    const jsonPathExpression = `${context.jsonColumnName}->>'$.${sanitizedKey}'`

    if (operator === '$like') {
      return {
        condition: `${jsonPathExpression} LIKE ?`,
        params: [context.convertValue(operand)],
      }
    }

    // Handle $regex
    return this.handleRegex(jsonPathExpression, operand, siblingOperators)
  }

  private handleRegex(
    jsonPathExpression: string,
    operand: any,
    siblingOperators?: Record<string, any>
  ): OperatorResult {
    // Get $options from sibling key if present
    const options = siblingOperators?.$options || ''
    let pattern: string
    let isCaseInsensitive = false

    if (typeof operand === 'string') {
      pattern = operand
    } else if (operand instanceof RegExp) {
      // Convert RegExp to string pattern
      // Note: MySQL REGEXP doesn't support all JS regex flags
      pattern = operand.source
      if (operand.ignoreCase) {
        isCaseInsensitive = true
      }
    } else {
      throw new Error(`Invalid operand for $regex: ${typeof operand}`)
    }

    // Apply case-insensitive option from sibling $options
    if (typeof options === 'string' && options.includes('i')) {
      isCaseInsensitive = true
    }

    // Optimize simple literal patterns to use LIKE instead of REGEXP
    // LIKE is more efficient for simple substring matching
    if (isSimpleLiteralPattern(pattern)) {
      if (isCaseInsensitive) {
        // MySQL LIKE is case-insensitive by default with most collations
        return {
          condition: `${jsonPathExpression} LIKE ?`,
          params: [`%${pattern}%`],
        }
      } else {
        // Use LIKE BINARY for case-sensitive matching
        return {
          condition: `${jsonPathExpression} LIKE BINARY ?`,
          params: [`%${pattern}%`],
        }
      }
    }

    // Use REGEXP for patterns with regex metacharacters
    if (isCaseInsensitive) {
      pattern = `(?i)${pattern}`
    }

    return {
      condition: `${jsonPathExpression} REGEXP ?`,
      params: [pattern],
    }
  }
}
