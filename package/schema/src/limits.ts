import SchemaConfig from './config'

export interface SchemaLimits {
  maxCollectionSize: number
  maxNodes: number
  maxFieldErrors: number
}

export class SchemaValidationLimits {
  static readonly DEFAULT_MAX_COLLECTION_SIZE = 10_000
  static readonly DEFAULT_MAX_NODES = 1_000_000
  static readonly DEFAULT_MAX_FIELD_ERRORS = 100

  /**
   * Resolve the limits from the given configs, earliest config winning, so a
   * per-call config overrides the schema's own config.
   */
  static resolve(...configs: Array<SchemaConfig | undefined>): SchemaLimits {
    const pick = (key: keyof SchemaLimits, fallback: number) =>
      configs.find((config) => config && config[key] !== undefined)?.[key] ??
      fallback

    return {
      maxCollectionSize: pick(
        'maxCollectionSize',
        SchemaValidationLimits.DEFAULT_MAX_COLLECTION_SIZE
      ),
      maxNodes: pick('maxNodes', SchemaValidationLimits.DEFAULT_MAX_NODES),
      maxFieldErrors: pick(
        'maxFieldErrors',
        SchemaValidationLimits.DEFAULT_MAX_FIELD_ERRORS
      ),
    }
  }

  /**
   * True when an array has more than max elements or an object more than max
   * keys. Objects are counted with an early exit so an oversized object is
   * never fully enumerated.
   */
  static exceeds(value: unknown, max: number): boolean {
    if (Array.isArray(value)) return value.length > max
    if (value === null || typeof value !== 'object') return false
    // Binary data is sized in bytes, not entries
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return false

    let count = 0
    for (const _key in value) {
      if (++count > max) return true
    }
    return false
  }
}

/**
 * Tracks the work done by a single validate call. The iterator spends one
 * node per field it visits and stops once the budget is gone.
 */
export class SchemaLimitTracker {
  nodes = 0
  nodeBudgetExceeded = false
  readonly rejectedPaths: string[] = []

  constructor(readonly limits: SchemaLimits) {}

  visit(): boolean {
    if (this.nodeBudgetExceeded) return false
    if (++this.nodes > this.limits.maxNodes) {
      this.nodeBudgetExceeded = true
      return false
    }
    return true
  }

  rejectCollection(path: string) {
    this.rejectedPaths.push(path)
  }

  exceedsCollection(value: unknown): boolean {
    return SchemaValidationLimits.exceeds(value, this.limits.maxCollectionSize)
  }
}
