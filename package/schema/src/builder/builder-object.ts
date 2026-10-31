import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import {
  Infer,
  InferShape,
  InferValue,
  IsAny,
  Markers,
  ShapeInput,
  SchemaThunk,
} from './infer'
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
  shape<S extends ShapeInput>(
    fields: S
  ): BuilderObject<InferShape<S>> & Markers<this> {
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        this.spec[key] = value
      }
    })
    return this.retyped()
  }

  /**
   * Define a match-all '*' spec for dynamic keys
   * This spec will be applied to all properties not explicitly defined
   */
  matchAll<B extends SchemaSpec | BuilderBase<any>>(
    fieldSpec: B
  ): BuilderObject<IsAny<T> extends true ? Record<string, InferValue<B>> : T> &
    Markers<this> {
    this.spec['*'] = fieldSpec
    return this.retyped()
  }

  /**
   * Reference another schema lazily
   * Example: .schema(() => schemaL10n)
   */
  schema<S extends SchemaThunk>(
    schema: S
  ): BuilderObject<Infer<ReturnType<S>>> & Markers<this> {
    this.spec.$schema = refSpec(schema).$schema
    return this.retyped()
  }

  /**
   * Type-only escape hatch for an object whose type the shape cannot express.
   * No runtime effect.
   */
  as<U>(): BuilderObject<U> & Markers<this> {
    return this.retyped()
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
