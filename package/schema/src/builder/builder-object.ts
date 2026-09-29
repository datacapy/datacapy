import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'

/**
 * Builder for Object field types
 * Provides object-specific configuration methods
 */
export class BuilderObject<T extends object = any> extends BuilderBase<T> {
  constructor(shape?: {
    [K in keyof T]?: SchemaSpec | BuilderBase<any>
  }) {
    super()
    if (shape) {
      this.shape(shape)
    }
  }

  protected getType() {
    return Object
  }

  /**
   * Define the shape of the object with specific fields
   * Accepts a map of field names to SchemaSpec or builder instances
   */
  shape(fields: {
    [K in keyof T]?: SchemaSpec | BuilderBase<any>
  }): this {
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        this.spec[key] = value instanceof BuilderBase ? value.build() : value
      }
    })
    return this
  }

  /**
   * Define a match-all '*' spec for dynamic keys
   * This spec will be applied to all properties not explicitly defined
   */
  matchAll(fieldSpec: SchemaSpec | BuilderBase<any>): this {
    const spec =
      fieldSpec instanceof BuilderBase ? fieldSpec.build() : fieldSpec
    this.spec['*'] = spec
    return this
  }

  /**
   * Reference another schema by name
   * Example: .schema('l10n')
   */
  schema(schemaName: string): this {
    this.spec.$schema = schemaName
    return this
  }

  /**
   * Enable or disable strict mode
   * In strict mode, fields not defined in the spec will cause validation errors
   */
  strict(value: boolean = true): this {
    this.spec.$strict = value
    return this
  }

  /**
   * Specify constructor function or name for object instances
   */
  construct(constructorName: string | Function): this {
    this.spec.$construct = constructorName
    return this
  }

  /**
   * Specify constructor function or name for collections of this object
   */
  constructCollection(constructorName: string | Function): this {
    this.spec.$constructCollection = constructorName
    return this
  }
}

export default BuilderObject
