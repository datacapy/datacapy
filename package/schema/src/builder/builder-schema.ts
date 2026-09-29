import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'

/**
 * Builder for top-level schema definitions
 * Used to create complete schemas with $name, $construct, etc.
 */
export class BuilderSchema {
  private spec: SchemaSpec = {}

  constructor(name?: string) {
    if (name) this.spec.$name = name
  }

  /**
   * Set the schema name
   */
  name(name: string): this {
    this.spec.$name = name
    return this
  }

  /**
   * Specify constructor function or name for schema instances
   */
  construct(constructorName: string | Function): this {
    this.spec.$construct = constructorName
    return this
  }

  /**
   * Specify constructor function or name for collections
   */
  constructCollection(constructorName: string | Function): this {
    this.spec.$constructCollection = constructorName
    return this
  }

  /**
   * Enable or disable strict mode
   */
  strict(value: boolean = true): this {
    this.spec.$strict = value
    return this
  }

  /**
   * Define the shape of the schema with specific fields
   */
  shape(fields: { [key: string]: SchemaSpec | BuilderBase<any> }): this {
    Object.entries(fields).forEach(([key, value]) => {
      this.spec[key] = value instanceof BuilderBase ? value.build() : value
    })
    return this
  }

  /**
   * Define a match-all '*' spec for dynamic keys
   */
  matchAll(fieldSpec: SchemaSpec | BuilderBase<any>): this {
    const spec =
      fieldSpec instanceof BuilderBase ? fieldSpec.build() : fieldSpec
    this.spec['*'] = spec
    return this
  }

  /**
   * Extend another schema (merge in its properties)
   */
  extend(baseSpec: SchemaSpec): this {
    Object.assign(this.spec, baseSpec)
    return this
  }

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
      return value.map((item) => BuilderSchema.buildValue(item))
    }

    // If it's a plain object, recursively process each property
    if (value && typeof value === 'object' && value.constructor === Object) {
      const result: any = {}
      for (const key in value) {
        result[key] = BuilderSchema.buildValue(value[key])
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
    const builtSpec: SchemaSpec = {}

    // Recursively build all properties in the spec
    for (const key in this.spec) {
      builtSpec[key] = BuilderSchema.buildValue(this.spec[key])
    }

    return builtSpec
  }
}

export default BuilderSchema
