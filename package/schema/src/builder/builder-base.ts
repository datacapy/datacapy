import SchemaSpec, {
  SchemaSpecEncryptOptions,
  SchemaSpecValidateOptions,
  CustomValidatorFn,
} from '../spec'
import { FilterConditionSpec } from '../filter/filter-condition'

/** Marker added to a builder's type by `required()` and `default()`. */
export interface BuilderPresent {
  readonly _present: true
}

/** Marker added to a builder's type by `optional()`; overrides `BuilderPresent`. */
export interface BuilderOptional {
  readonly _optional: true
}

/** Marker added to a builder's type by `nullable()`. */
export interface BuilderNullable {
  readonly _nullable: true
}

/**
 * Abstract base class for all field builders
 * Provides common validation and filter methods that all field types inherit
 * @template T - The TypeScript type this builder represents (for type inference)
 */
export abstract class BuilderBase<T = any> {
  /** Type-only members read by `Infer`; never assigned at runtime. */
  declare readonly _type: T
  declare readonly _present: boolean
  declare readonly _nullable: boolean
  declare readonly _optional: boolean

  protected spec: SchemaSpec = {}

  /** Set by `init()`; never part of the spec. */
  private initial?: { value: unknown }

  /**
   * Type-only: the same builder, seen with a new value type. Builder methods
   * that change the inferred type (`shape()`, `of()`, `as()`) return it.
   */
  protected retyped<R>(): R {
    return this as unknown as R
  }

  /**
   * Get the type constructor for this field (String, Number, Date, etc.)
   */
  protected abstract getType(): any

  // ==================== Validation Methods ====================

  /**
   * Mark field as required (must be present). Also makes the inferred key non-optional.
   */
  required(options?: SchemaSpecValidateOptions): this & BuilderPresent {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.required = options || true
    return this as this & BuilderPresent
  }

  /**
   * Type-only: keep the inferred key optional (`key?: T`) even after
   * `default()` or `required()`. No runtime effect; use it where callers build
   * partial objects and the schema fills the default in.
   */
  optional(): this & BuilderOptional {
    return this as this & BuilderOptional
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
   * Add a custom validation function.
   * The function receives (value, options) where options includes:
   * - root: the full object being validated
   * - label: the field label
   *
   * @param validator - Function that returns true if valid, or error message(s) if invalid
   * @param options - Optional validation options (name, message)
   */
  validate(
    validator: CustomValidatorFn,
    options?: SchemaSpecValidateOptions
  ): this {
    if (!this.spec.$validate) this.spec.$validate = {}

    const customConfig = { validator, ...options }

    // Support multiple callback validators
    if (this.spec.$validate.callback) {
      if (Array.isArray(this.spec.$validate.callback)) {
        this.spec.$validate.callback.push(customConfig)
      } else {
        this.spec.$validate.callback = [
          this.spec.$validate.callback,
          customConfig,
        ]
      }
    } else {
      this.spec.$validate.callback = customConfig
    }

    return this
  }

  // ==================== Filter Methods ====================

  /**
   * Set default value if field is undefined. A defaulted field is always
   * present after filtering, so the inferred key is non-optional.
   * `default(null)` also marks the field nullable.
   */
  default(value: null): this & BuilderPresent & BuilderNullable
  default(value: any): this & BuilderPresent
  default(value: any): this & BuilderPresent {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.defaultValue = value
    return this as this & BuilderPresent
  }

  /**
   * Construct-time default: what `applyDefaults` fills when the value is
   * missing, without adding a filter to the spec. Use it where a constructor
   * starts a field at a value (`''`, `0`) that the schema must not apply on
   * validation, for example a `required()` field, because `required()` plus
   * `default()` accepts a missing value. A `default()` on the same field wins.
   */
  init(value: null): this & BuilderPresent & BuilderNullable
  init(value: any): this & BuilderPresent
  init(value: any): this & BuilderPresent {
    this.initial = { value }
    return this as this & BuilderPresent
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
   * Encrypt field value at rest using the configured encryptionService.
   * Reads leave the value encrypted unless the query asks for decryption,
   * or the field is `{ eager: true }`.
   */
  encrypt(mode?: boolean | SchemaSpecEncryptOptions): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    ;(this.spec.$filter as any).encrypt = mode === undefined ? true : mode
    return this
  }

  /**
   * Apply custom filter function
   */
  filter(fn: (value: any) => boolean | string): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.callback = fn
    return this
  }

  /**
   * Apply a named filter only if a condition on the value is met
   */
  filterIf(
    filterName: string,
    condition: FilterConditionSpec,
    filterConfig?: any
  ): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    ;(this.spec.$filter as any)[filterName] = {
      $if: condition,
      ...(filterConfig !== undefined ? { $then: filterConfig } : {}),
    }
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
  nullable(): this & BuilderNullable {
    this.spec.$nullable = true
    return this as this & BuilderNullable
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

  // ==================== Defaults ====================

  /**
   * True when `default()` was set on this builder.
   */
  hasDefault(): boolean {
    return this.spec.$filter?.defaultValue !== undefined
  }

  /**
   * The default as a plain value, computed synchronously: a function default
   * is called, and a Date field turns the keyword 'now' into the current time,
   * as the async default filter does. For constructors that must fill defaults
   * without running a validation. A plain object or array default is copied,
   * so two results never share one.
   */
  resolveDefault(): unknown {
    return this.resolveValue(this.spec.$filter?.defaultValue)
  }

  /**
   * True when `default()` or `init()` gave this field a starting value.
   */
  hasInitial(): boolean {
    return this.hasDefault() || this.initial !== undefined
  }

  /**
   * The starting value of a field: its `default()`, else its `init()` value,
   * resolved as `resolveDefault` does.
   */
  resolveInitial(): unknown {
    return this.hasDefault()
      ? this.resolveDefault()
      : this.resolveValue(this.initial?.value)
  }

  /**
   * A Date field turns a value that is not already a Date into one; every
   * other field, and null or undefined, pass through.
   */
  coerce(value: unknown): unknown {
    return this.getType() === Date && value != null && !(value instanceof Date)
      ? new Date(value as string | number)
      : value
  }

  /**
   * What a field's `construct()` names when it is a class or a thunk for one,
   * not a registered constructor name. Resolve it with `resolveConstructor`.
   */
  constructedBy(): Function | undefined {
    const construct = this.spec.$construct
    return typeof construct === 'function' ? construct : undefined
  }

  /** The same for each item of an array field; only arrays have one. */
  itemConstructedBy(): Function | undefined {
    return undefined
  }

  private resolveValue(raw: unknown): unknown {
    const value = typeof raw === 'function' ? raw() : this.copyLiteral(raw)
    if (this.getType() !== Date || value == null || value instanceof Date) {
      return value
    }
    return typeof value === 'string' && value.trim().toLowerCase() === 'now'
      ? new Date()
      : new Date(value as string | number)
  }

  private copyLiteral(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.copyLiteral(v))
    if (
      value !== null &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.copyLiteral(v)])
      )
    }
    return value
  }

  // ==================== Build Method ====================

  /**
   * Recursively process a value, calling build() on any builder objects.
   * Public so boundaries that need a plain spec (e.g. the Schema constructor)
   * can accept a builder and resolve it at the last moment.
   */
  static resolve(value: any): any {
    // If it's a builder instance, build it
    if (value instanceof BuilderBase) {
      return value.build()
    }

    // If it's an array, recursively process each element
    if (Array.isArray(value)) {
      return value.map((item) => BuilderBase.resolve(item))
    }

    // If it's a plain object, recursively process each property
    if (value && typeof value === 'object' && value.constructor === Object) {
      const result: any = {}
      for (const key in value) {
        result[key] = BuilderBase.resolve(value[key])
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
      builtSpec[key] = BuilderBase.resolve(this.spec[key])
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
