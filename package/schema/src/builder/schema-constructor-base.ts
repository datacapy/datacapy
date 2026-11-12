import type { Plain } from './infer'

/**
 * The raw data a class built on `SchemaConstructorBase` accepts: its data
 * fields, each optional and nullable, in plain-data form or as the instance
 * itself. Methods are dropped.
 */
export type SchemaConstructorBaseInput<T> = {
  -readonly [
    K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K
  ]?: Plain<T[K]> | T[K] | null
}

/**
 * Optional base for a class that declares its own fields and gets its schema
 * generated from them (`/** @schema note *\/` on the class):
 *
 *   class Note extends SchemaConstructorBase<Note> {
 *     text!: string & t.Trim
 *   }
 *
 * The constructor copies the data onto the instance and nothing more: defaults
 * come from `validate()` or `applyDefaults`, not from `new`. A class that needs
 * more writes its own constructor and skips this base.
 *
 * The class is named only as a type argument, so the base does not depend on
 * the generated schema (which is derived from the class).
 */
export class SchemaConstructorBase<T> {
  constructor(data?: SchemaConstructorBaseInput<T> | null) {
    if (data) Object.assign(this, data)
  }
}
