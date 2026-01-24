import SchemaSpec, {
  SchemaSpecValidateOptions,
  SchemaSpecValidateOptionsRemote,
} from '../spec'

/**
 * Abstract base class for all field builders
 * Provides common validation and filter methods that all field types inherit
 * @template T - The TypeScript type this builder represents (for type inference)
 */
// @ts-ignore - T is used for type inference, not in implementation
export abstract class BuilderBase<T = any> {
  protected spec: SchemaSpec = {}

  /**
   * Get the type constructor for this field (String, Number, Date, etc.)
   */
  protected abstract getType(): any

  // ==================== Validation Methods ====================

  /**
   * Mark field as required (must be present)
   */
  required(options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.required = options || true
    return this
  }

  /**
   * Field cannot be null
   */
  notNull(options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.notNull = options || true
    return this
  }

  /**
   * Field cannot be empty (empty string, empty array, etc.)
   */
  notEmpty(options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.notEmpty = options || true
    return this
  }

  /**
   * Field must be empty
   */
  isEmpty(options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.isEmpty = options || true
    return this
  }

  /**
   * Validate field against a remote API endpoint
   */
  remote(options: SchemaSpecValidateOptionsRemote): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.remote = options
    return this
  }

  // ==================== Filter Methods ====================

  /**
   * Set default value if field is undefined
   */
  default(value: any): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.defaultValue = value
    return this
  }

  /**
   * Mark field as private (will be filtered out)
   */
  private(mode?: boolean | string): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    ;(this.spec.$filter as any).private = mode === undefined ? true : mode
    return this
  }

  /**
   * Replace value with boolean indicating presence (hides actual value)
   */
  privateValue(mode?: boolean | string): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    ;(this.spec.$filter as any).privateValue = mode === undefined ? true : mode
    return this
  }

  /**
   * Apply custom filter function
   */
  custom(fn: (value: any) => boolean | string): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.custom = fn
    return this
  }

  // ==================== Metadata Methods ====================

  /**
   * Set field label (for error messages, UI, etc.)
   */
  label(label: string): this {
    this.spec.$label = label
    return this
  }

  /**
   * Allow null value for this field
   * Applies to objects, arrays, and primitive types
   */
  nullable(): this {
    this.spec.$nullable = true
    return this
  }

  /**
   * Disable type casting for this field and all nested fields
   * When true, values are stored as-is without type conversion
   * Inherits down the tree unless explicitly set to false on a nested field
   * @param value - true to disable casting, false to enable (default: true)
   */
  noCast(value: boolean = true): this {
    this.spec.$noCast = value
    return this
  }

  /**
   * Mark this field as a database relation
   * Used by REST API to handle related entities
   */
  relation(value: boolean = true): this {
    this.spec.$relation = value
    return this
  }

  // ==================== Build Method ====================

  /**
   * Recursively process a value, calling build() on any builder objects
   */
  private static buildValue(value: any): any {
    // If it's a builder instance, build it
    if (value instanceof BuilderBase) {
      return value.build()
    }

    // If it's an array, recursively process each element
    if (Array.isArray(value)) {
      return value.map((item) => BuilderBase.buildValue(item))
    }

    // If it's a plain object, recursively process each property
    if (value && typeof value === 'object' && value.constructor === Object) {
      const result: any = {}
      for (const key in value) {
        result[key] = BuilderBase.buildValue(value[key])
      }
      return result
    }

    // Otherwise return as-is
    return value
  }

  /**
   * Build and return the final SchemaSpec
   */
  build(): SchemaSpec {
    const type = this.getType()
    const builtSpec: SchemaSpec = {}

    // Recursively build all properties in the spec
    for (const key in this.spec) {
      builtSpec[key] = BuilderBase.buildValue(this.spec[key])
    }

    return {
      ...builtSpec,
      ...(type !== undefined && { $type: type }),
    }
  }

  /**
   * Get the current spec (for internal use)
   */
  protected getSpec(): SchemaSpec {
    return this.spec
  }
}

export default BuilderBase
