import type { Schema } from '../schema'
import type { InferInputSpec, InferSpec, Plain, SpecInput } from './infer'
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
 * The raw data a class that extends `SchemaConstructor<T>` accepts: its data
 * fields, each optional and nullable, in plain-data form or as the instance
 * itself. Methods are dropped.
 */
export type SchemaConstructorInput<T> = {
  -readonly [
    K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K
  ]?: Plain<T[K]> | T[K] | null
}

/**
 * Two ways to give a model class its constructor.
 *
 * `SchemaConstructor.from(SchemaNote)` builds a base class from a schema, so a
 * model class is its schema's fields and nothing else:
 *
 *   class Note extends SchemaConstructor.from(SchemaNote) {}
 *
 * The input is raw data (plain objects, `null` for missing); the instance is
 * `InferSpec`; defaults are filled. Behaviour goes in the class body.
 *
 * `SchemaConstructor<T>` is the base for a class that declares its own fields
 * and gets its schema generated from them (`/** @schema note *\/` on the class):
 *
 *   class Note extends SchemaConstructor<Note> {
 *     text!: string & t.Trim
 *   }
 *
 * Its constructor copies the data onto the instance and nothing more: defaults
 * come from `validate()` or `applyDefaults`, not from `new`. The class is named
 * only as a type argument, so the base does not depend on the generated schema
 * (which is derived from the class). A class that needs more writes its own
 * constructor and skips this base.
 */
export class SchemaConstructor<T = unknown> {
  constructor(data?: SchemaConstructorInput<T> | null) {
    if (data) Object.assign(this, data)
  }

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
