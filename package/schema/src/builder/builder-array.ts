import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import { InferValue, SchemaThunk, Infer } from './infer'
import { isSchemaThunk, refSpec } from './builder-ref'

/** What `array().of()` accepts: a builder, a plain spec or a lazy schema reference. */
export type ArrayItemInput = SchemaSpec | BuilderBase | SchemaThunk

/** The item type for an `of()` argument. */
export type ArrayItem<X> = X extends BuilderBase
  ? InferValue<X>
  : X extends () => infer S
    ? Infer<S>
    : any

/**
 * Builder for Array field types
 * Provides array-specific configuration methods
 */
export class BuilderArray<T = any> extends BuilderBase<T[]> {
  constructor(itemSpec?: ArrayItemInput) {
    super()
    if (itemSpec !== undefined) {
      this.of(itemSpec)
    }
  }

  protected getType() {
    return Array
  }

  /**
   * Specify the schema spec for array items
   * Accepts a builder, a SchemaSpec object, or a lazy schema reference such
   * as `() => schemaQuestion`. The item type is inferred from the argument.
   */
  of<X extends ArrayItemInput>(itemSpec: X): BuilderArray<ArrayItem<X>> {
    this.spec.$spec = isSchemaThunk(itemSpec) ? refSpec(itemSpec) : itemSpec
    return this as BuilderArray<any>
  }

  /**
   * Type-only escape hatch: state the item type when the spec cannot express
   * it. No runtime effect.
   */
  as<U>(): BuilderArray<U> {
    return this as BuilderArray<any>
  }

  /**
   * Specify constructor function or name for array items
   */
  construct(constructorName: string | Function): this {
    this.spec.$construct = constructorName
    return this
  }

  /**
   * Specify constructor function or name for the collection itself
   */
  constructCollection(constructorName: string | Function): this {
    this.spec.$constructCollection = constructorName
    return this
  }
}

export default BuilderArray
