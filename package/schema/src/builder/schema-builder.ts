/**
 * Main entry point for the builder API
 * Use `sb.string()`, `sb.number()`, etc. to create field builders
 */

import { BuilderString } from './builder-string'
import { BuilderNumber } from './builder-number'
import { BuilderBoolean } from './builder-boolean'
import { BuilderDate } from './builder-date'
import { BuilderArray } from './builder-array'
import { BuilderObject } from './builder-object'
import { BuilderMixed } from './builder-mixed'
import { BuilderOr } from './builder-or'
import { BuilderSchema } from './builder-schema'
import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import { ArrayItem, ArrayItemInput } from './builder-array'
import { BuilderRef } from './builder-ref'
import { OrValue } from './builder-or'
import { Infer, InferShape, SchemaThunk, ShapeInput } from './infer'

export class SchemaBuilder {
  /**
   * Create a string field builder
   */
  static string(): BuilderString {
    return new BuilderString()
  }

  /**
   * Create a number field builder
   */
  static number(): BuilderNumber {
    return new BuilderNumber()
  }

  /**
   * Create a boolean field builder
   */
  static boolean(): BuilderBoolean {
    return new BuilderBoolean()
  }

  /**
   * Create a date field builder
   */
  static date(): BuilderDate {
    return new BuilderDate()
  }

  /**
   * Create an array field builder
   */
  static array(): BuilderArray<any>
  static array<X extends ArrayItemInput>(
    itemSpec: X
  ): BuilderArray<ArrayItem<X>>
  static array(itemSpec?: ArrayItemInput): BuilderArray<any> {
    return new BuilderArray(itemSpec)
  }

  /**
   * Create an object field builder
   */
  static object(): BuilderObject<any>
  static object<S extends ShapeInput>(shape: S): BuilderObject<InferShape<S>>
  static object(shape?: ShapeInput): BuilderObject<any> {
    return new BuilderObject(shape)
  }

  /**
   * Create a mixed (any) field builder
   */
  static mixed(): BuilderMixed<unknown> {
    return new BuilderMixed()
  }

  /**
   * Create an $or field builder for alternative specs
   */
  static or<const X extends ReadonlyArray<SchemaSpec | BuilderBase<any>>>(
    specs: X
  ): BuilderOr<OrValue<X>> {
    return new BuilderOr(specs)
  }

  /**
   * Create a top-level schema builder
   */
  static schema(name?: string): BuilderSchema<{}> {
    return new BuilderSchema(name)
  }

  /**
   * Reference another schema lazily; the type is inferred from the schema.
   * Example: sb.ref(() => schemaSurveyQuestion)
   */
  static ref<S extends SchemaThunk>(
    schema: S
  ): BuilderRef<Infer<ReturnType<S>>> {
    return new BuilderRef(schema)
  }

  /**
   * Fill the defaults of a shape into `data`: each key that is missing or
   * null takes its `default()` value. Other values pass through untouched, and
   * a key with no default stays as given. A synchronous counterpart of the
   * default filter, for a constructor that sets its own fields.
   */
  static applyDefaults<S extends ShapeInput>(
    shape: S,
    data?: Partial<InferShape<S>> | null
  ): Partial<InferShape<S>> {
    const result: Record<string, unknown> = { ...data }
    for (const [key, field] of Object.entries(shape)) {
      if (
        field instanceof BuilderBase &&
        field.hasDefault() &&
        result[key] == null
      ) {
        result[key] = field.resolveDefault()
      }
    }
    return result as Partial<InferShape<S>>
  }
}
