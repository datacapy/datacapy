import { BuilderBase } from './builder-base'
import {
  SchemaSpecValidateOptions,
  SchemaSpecValidateOptionsInArray,
  SchemaSpecValidateOptionsRegex,
} from '../spec'

/**
 * Builder for String field types
 * Provides string-specific validation and filter methods
 */
export class BuilderString extends BuilderBase<string> {
  protected getType() {
    return String
  }

  // ==================== String Validation Methods ====================

  /**
   * Validate as email address
   */
  email(options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.email = options || true
    return this
  }

  /**
   * Set minimum length
   */
  minLength(min: number, options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    if (!this.spec.$validate.valueLength) {
      this.spec.$validate.valueLength = {}
    }
    this.spec.$validate.valueLength.min = min
    if (options) {
      Object.assign(this.spec.$validate.valueLength, options)
    }
    return this
  }

  /**
   * Set maximum length
   */
  maxLength(max: number, options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    if (!this.spec.$validate.valueLength) {
      this.spec.$validate.valueLength = {}
    }
    this.spec.$validate.valueLength.max = max
    if (options) {
      Object.assign(this.spec.$validate.valueLength, options)
    }
    return this
  }

  /**
   * Set both minimum and maximum length
   */
  length(min: number, max: number, options?: SchemaSpecValidateOptions): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.valueLength = { min, max, ...options }
    return this
  }

  /**
   * Validate against regular expression pattern
   */
  regex(
    pattern: RegExp | string,
    options?: SchemaSpecValidateOptionsRegex
  ): this {
    if (!this.spec.$validate) this.spec.$validate = {}

    const regexSpec: SchemaSpecValidateOptionsRegex = {
      pattern,
      ...options,
    }

    // Support multiple regex patterns
    if (this.spec.$validate.regex) {
      if (Array.isArray(this.spec.$validate.regex)) {
        this.spec.$validate.regex.push(regexSpec)
      } else {
        this.spec.$validate.regex = [this.spec.$validate.regex, regexSpec]
      }
    } else {
      this.spec.$validate.regex = regexSpec
    }

    return this
  }

  /**
   * Value must be one of the specified values
   */
  inArray(values: string[], options?: SchemaSpecValidateOptionsInArray): this {
    if (!this.spec.$validate) this.spec.$validate = {}
    this.spec.$validate.inArray = {
      values,
      ...options,
    }
    return this
  }

  // ==================== String Filter Methods ====================

  /**
   * Trim whitespace from beginning and end
   */
  trim(): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.trim = true
    return this
  }

  /**
   * Convert to uppercase
   */
  uppercase(): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.uppercase = true
    return this
  }

  /**
   * Convert to lowercase
   */
  lowercase(): this {
    if (!this.spec.$filter) this.spec.$filter = {}
    this.spec.$filter.lowercase = true
    return this
  }

  /**
   * Strip HTML tags from the string
   */
  stripHtml(): this {
    if (!this.spec.$filter)
      this.spec.$filter = {}
      // Note: stripHtml is added via filter config, not in base SchemaSpecFilter interface
      // but it's supported in the Filter.filter() implementation
    ;(this.spec.$filter as any).stripHtml = true
    return this
  }
}

export default BuilderString
