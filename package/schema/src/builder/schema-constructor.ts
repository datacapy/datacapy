import type { Schema } from '../schema'
import type { InferInputSpec, InferSpec, SpecInput } from './infer'
import { SchemaBuilder } from './schema-builder'

/**
 * The class `SchemaConstructor.from` returns. A named alias, so a declaration
 * file written by a package without strictNullChecks refers to it instead of
 * spelling the fields out, and a strict consumer sees the nulls.
 */
export type SchemaConstructorClass<S> = new (
  data?: InferInputSpec<S> | null
) => InferSpec<S>

/**
 * Builds a constructor base class from a schema, so a model class is its
 * schema's fields and nothing else:
 *
 *   class Note extends SchemaConstructor.from(SchemaNote) {}
 *
 * The input is raw data (plain objects, `null` for missing); the instance is
 * `InferSpec`. Behaviour goes in the class body.
 */
export class SchemaConstructor {
  static from<S extends SpecInput>(
    schema: new () => Schema<S>
  ): SchemaConstructorClass<S> {
    const fillDefaults = SchemaBuilder.defaultsFor(schema)
    return class {
      constructor(data?: unknown) {
        fillDefaults(data as Record<string, unknown> | null, this)
      }
    } as never
  }
}
