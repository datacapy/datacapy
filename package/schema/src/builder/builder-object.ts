import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import { Infer, InferShape, ShapeInput, SchemaThunk } from './infer'
import { refSpec } from './builder-ref'

/**
 * Builder for Object field types
 * Provides object-specific configuration methods
 */
export class BuilderObject<T = any> extends BuilderBase<T> {
  constructor(shape?: ShapeInput) {
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
  shape<S extends ShapeInput>(fields: S): BuilderObject<InferShape<S>> {
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        this.spec[key] = value instanceof BuilderBase ? value.build() : value
      }
    })
    return this as BuilderObject<any>
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
   * Reference another schema lazily
   * Example: .schema(() => schemaL10n)
   */
  schema<S extends SchemaThunk>(
    schema: S
  ): BuilderObject<Infer<ReturnType<S>>> {
    this.spec.$schema = refSpec(schema).$schema
    return this as BuilderObject<any>
  }

  /**
   * Type-only escape hatch for an object whose type the shape cannot express.
   * No runtime effect.
   */
  as<U>(): BuilderObject<U> {
    return this as BuilderObject<any>
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
