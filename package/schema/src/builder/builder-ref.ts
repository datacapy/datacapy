import { BuilderBase } from './builder-base'
import SchemaSpec from '../spec'
import { Infer, SchemaThunk } from './infer'

const nameReaders = new WeakMap<SchemaThunk, () => string>()

/**
 * The function stored as `$schema`. One per thunk, so building twice gives
 * specs that compare equal.
 */
function nameReader(schema: SchemaThunk): () => string {
  let reader = nameReaders.get(schema)
  if (!reader) {
    reader = () => schema().getName()
    nameReaders.set(schema, reader)
  }
  return reader
}

/**
 * A reference to another schema by a lazy function: `sb.ref(() => schemaL10n)`.
 * The name is read when the spec is first used, not when it is built, so the
 * referenced schema can be defined later or sit in an import cycle.
 */
export class BuilderRef<T = any> extends BuilderBase<T> {
  constructor(private readonly schema: SchemaThunk) {
    super()
  }

  protected getType() {
    return undefined
  }

  build(): SchemaSpec {
    return { ...super.build(), $schema: nameReader(this.schema) }
  }
}

/**
 * True for a lazy schema reference. A type shorthand such as `String` is also
 * a function, but constructors have a `prototype` and arrow functions do not.
 */
export function isSchemaThunk(value: unknown): value is SchemaThunk {
  return typeof value === 'function' && !('prototype' in value)
}

/** Build the spec for a lazy reference. */
export function refSpec(schema: SchemaThunk): SchemaSpec {
  return new BuilderRef(schema).build()
}

export type RefOf<S> = BuilderRef<Infer<S>>

export default BuilderRef
