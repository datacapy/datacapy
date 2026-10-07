import { sanitizeIdentifier } from '../mysql-sql-utils'
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
      const value = String(context.convertValue(operand))
      const lowercaseColumn = await context.getLowercaseGeneratedColumnName(key)
      if (lowercaseColumn) {
        return {
          condition: `\`${sanitizeIdentifier(lowercaseColumn)}\` LIKE ?`,
          params: [value.toLowerCase()],
        }
      }
      return {
        condition: `LOWER(${jsonPathExpression}) LIKE ?`,
        params: [value.toLowerCase()],
      }
    }

    // Handle $regex
    return this.handleRegex(
      key,
      jsonPathExpression,
      operand,
      context,
      siblingOperators
    )
  }

  private async handleRegex(
    key: string,
    jsonPathExpression: string,
    operand: any,
    context: OperatorContext,
    siblingOperators?: Record<string, any>
  ): Promise<OperatorResult> {
    // Get $options from sibling key if present
    const options = siblingOperators?.$options || ''
    let pattern: string
    let isCaseInsensitive = false
    // A string operand is always a literal substring match, so untrusted
    // input can never inject regex syntax. A RegExp operand is the explicit
    // opt-in to real regex semantics.
    let isLiteral: boolean

    if (typeof operand === 'string') {
      pattern = operand
      isLiteral = true
    } else if (operand instanceof RegExp) {
      // Convert RegExp to string pattern
      // Note: MySQL REGEXP doesn't support all JS regex flags
      pattern = operand.source
      isLiteral = isSimpleLiteralPattern(pattern)
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

    // Literal patterns use LIKE (also cheaper than REGEXP for substring matching)
    if (isLiteral) {
      const escaped = this.escapeLike(pattern)
      if (isCaseInsensitive) {
        const lowercaseColumn =
          await context.getLowercaseGeneratedColumnName(key)
        if (lowercaseColumn) {
          return {
            condition: `\`${sanitizeIdentifier(lowercaseColumn)}\` LIKE ?`,
            params: [`%${this.escapeLike(pattern.toLowerCase())}%`],
          }
        }
        // JSON extraction (->>) returns utf8mb4_bin collation, making plain LIKE
        // case-sensitive. Wrap with LOWER() on both sides to force case-insensitive matching.
        return {
          condition: `LOWER(${jsonPathExpression}) LIKE ?`,
          params: [`%${this.escapeLike(pattern.toLowerCase())}%`],
        }
      }
      // Use LIKE BINARY for case-sensitive matching
      return {
        condition: `${jsonPathExpression} LIKE BINARY ?`,
        params: [`%${escaped}%`],
      }
    }

    // Use REGEXP for RegExp operands with regex metacharacters
    if (isCaseInsensitive) {
      pattern = `(?i)${pattern}`
    }

    return {
      condition: `${jsonPathExpression} REGEXP ?`,
      params: [pattern],
    }
  }

  /**
   * Escapes LIKE wildcards (and the escape character) so the value matches literally.
   */
  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&')
  }
}
