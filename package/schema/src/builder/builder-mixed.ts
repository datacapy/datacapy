import { BuilderBase } from './builder-base'
import SchemaTypes from '../types'
import { Markers } from './infer'

/**
 * Builder for Mixed (any) field types
 * Accepts any type of value without type casting.
 * Infers `unknown`; call `as<T>()` to state the type.
 */
export class BuilderMixed<T = unknown> extends BuilderBase<T> {
  protected getType() {
    return SchemaTypes.Mixed
  }

  /**
   * Type-only: state the value type. No runtime effect.
   */
  as<U>(): BuilderMixed<U> & Markers<this> {
    return this.retyped()
  }
}

export default BuilderMixed
