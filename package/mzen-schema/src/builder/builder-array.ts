import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'

/**
 * Builder for Array field types
 * Provides array-specific configuration methods
 */
export class BuilderArray<T = any> extends BuilderBase<T[]> {
  constructor(itemSpec?: SchemaSpec | BuilderBase<any>) {
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
   * Accepts either a SchemaSpec object or another builder
   */
  of(itemSpec: SchemaSpec | BuilderBase<any>): this {
    const spec = itemSpec instanceof BuilderBase ? itemSpec.build() : itemSpec
    this.spec.$spec = spec
    return this
  }

  /**
   * Shorthand for specifying array items using a schema reference
   * Example: .ofSchema('surveyQuestion')
   */
  ofSchema(schemaName: string): this {
    this.spec.$spec = { $schema: schemaName }
    return this
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
