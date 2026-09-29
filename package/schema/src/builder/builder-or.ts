import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'

/**
 * Builder for $or operator support
 * Allows multiple alternative schema specs where any one can match
 */
export class BuilderOr extends BuilderBase<any> {
  private orSpecs: Array<SchemaSpec | BuilderBase<any>> = []

  constructor(specs: Array<SchemaSpec | BuilderBase<any>>) {
    super()
    this.orSpecs = specs
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

export default BuilderOr
