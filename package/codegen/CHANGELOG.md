# @datacapy/codegen

## 0.1.0

### Minor Changes

- 1e1f917: Add the `ConstructCollection<Name>` tag. On an array property, or an array element of another array, the generator emits `.constructCollection('Name')`. On any other type it fails the run.
- 1e1f917: Add a `collections` config map (schema name to collection class name) that emits `.constructCollection('Name')` after `.construct(...)` and before `.strict()`.
- 1e1f917: Add the `InitFn<Name>` and `DefaultFn<Name>` tags. The generator emits `init(initialisers.Name)` and `default(initialisers.Name)`, importing `initialisers` from the configured `registry` module beside `validators` and `filters`.
- 1e1f917: Generate string-keyed maps and opaque objects. `{ [k: string]: V }` and `Record<string, V>` emit `sb.object().matchAll(V)`, `Record<string, unknown>` and `object` emit `sb.object().as<...>()`, and a marked interface that is only an index signature emits a schema-level `matchAll` with no `shape`.
- 1e1f917: New package: `datacapy-gen` generates schema modules from tagged interfaces (primitives, literal unions, arrays, nullability, presence, defaults and string tags).
- 1e1f917: Generate references to other `@schema` interfaces, inline objects, unions of objects, `Relation`, and `Validate`/`Filter` callbacks from a registry module. Output is formatted with the consumer's Prettier. Add `datacapy-gen --staged` for lint-staged. `@datacapy/schema` gains `sb.refTo<T>()`, a reference with a stated type that works in a schema cycle.
- 1e1f917: Add `datacapy-gen --report`, which lists every unsupported property across all marked interfaces instead of stopping at the first, and writes nothing.
- 1e1f917: The `@schema` marker accepts `construct=<Name>`, `strict` and `no-strict`, and `datacapy.config.json` gains a `strict` default. The generator emits `sb.schema('x').construct('X').strict().shape({...})`. An unknown marker option fails the run.
