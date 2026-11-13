# @datacapy/codegen

## 0.2.0

### Minor Changes

- 76ad074: `Default` and `Init` accept an array of literals, such as `Default<['en']>`, and generate `.default(['en'])`. `ArrayValue` is the new tag value type; `EmptyArray` still works.
- 2976ad6: Generate a schema from a class. `/** @schema name */` on a class reads its data fields (methods, accessors, statics and private members are left out, inherited fields are included) and constructs by the class name. `@datacapy/schema` adds `SchemaConstructor<T>`, an optional base that copies the constructor data onto the instance.
- 76ad074: Add the `Construct<Name>` tag, which generates `construct('Name')` with the constructor found by name. It carries a constructed relation such as a populated child record, and keeps `nullable()` beside `Default<null>` so the constructor is skipped for a null value.
- 76ad074: `Opaque` now works on a property nested inside an array of objects (`messages[].user`), not only on a top-level property. The generated `as<...>()` type walks the path with `NonNullable` and `[number]`.
- 76ad074: Add the `NotNull` tag, which generates `notNull()`. `required()` alone accepts `null`, so a field that must reject it needs the tag.
- 76ad074: `Default` and `Init` accept an object of literals, such as `Init<{ period: 'month'; day: 1; reminderSentAt: null }>`, and generate `.init({ period: 'month', day: 1, reminderSentAt: null })`. Nested objects work too.
- 76ad074: Add the `EmptyArray`, `NonStrict` and `Opaque` tags, so free-form arrays and objects can be generated: `Default<t.EmptyArray>`, `strict(false)`, and `as<T>()` without validating the contents.
- 37a51e8: Add the `Required` and `OneOf` tags. `Required` keeps `required()` on a key that also has `Default` or `Init`, which otherwise replace it. `OneOf<'a' | 'b'>` restricts a plain `string` with `inArray<string>([...])`, for a model whose TypeScript type is deliberately wider than its allowed values. `Default<EmptyObject>` now defaults a field to an empty object. `unknown & Relation` (any tag on `unknown`) generates `sb.mixed()` with the tag. `AssertSchema` and `AssertSpec` accept a tagged literal union such as `('a' | 'b') & Default<'a'>`, which cannot be stripped to the plain union, by checking that the two types are assignable to each other.

### Patch Changes

- 2976ad6: Fix generated references: `sb.refTo(() => SchemaX)` returned the class, so validating a schema with a reference failed at run time with `getName is not a function`. The generator now emits `new SchemaX()`.

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
