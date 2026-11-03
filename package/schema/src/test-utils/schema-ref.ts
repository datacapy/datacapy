import { SchemaThunk } from '../builder/infer'

/** A lazy schema reference to a schema called `name`, for builder tests. */
export function refTo(name: string): SchemaThunk {
  return () => ({ getName: () => name }) as ReturnType<SchemaThunk>
}

/** Resolve the `$schema` of a built spec (a lazy function, or a plain name) to its name. */
export function refName(schema: unknown): unknown {
  return typeof schema === 'function' ? schema() : schema
}
