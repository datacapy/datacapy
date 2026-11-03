import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import { InferValue } from './infer'

/**
 * Builder for $or operator support
 * Allows multiple alternative schema specs where any one can match
 */
export class BuilderOr<T = any> extends BuilderBase<T> {
  private orSpecs: Array<SchemaSpec | BuilderBase<any>> = []

  constructor(specs: ReadonlyArray<SchemaSpec | BuilderBase<any>>) {
    super()
    this.orSpecs = [...specs]
  }

  protected getType() {
    // $or doesn't have a specific type
    return undefined
  }

  /**
   * Build the $or spec
   */
  build(): SchemaSpec {
    return {
      ...this.spec,
      $or: this.orSpecs.map((spec) =>
        spec instanceof BuilderBase ? spec.build() : spec
      ),
    }
  }
}

/** The union of the alternatives' value types. */
export type OrValue<X extends ReadonlyArray<unknown>> = InferValue<X[number]>

export default BuilderOr
