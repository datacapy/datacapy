# @datacapy/schema

## 2.0.0

### Major Changes

- e83b25d: Remove the `sb`, `relb` and `repib` exports (and the default `sb`
  export). Import `SchemaBuilder`, `RepoRelationBuilder` and `RepoIndexBuilder`
  and alias them locally, e.g.
  `import { SchemaBuilder as sb } from '@datacapy/schema'`.
- c1164a8: `Schema.from(builderSchema)` returns a base class typed with the
  schema spec, so a schema is one exported class instead of a spec object plus a
  class. `Infer` and `sb.defaultsFor()` accept a schema class or instance as
  well as a spec of builders. The type-level names move from "shape" to "schema
  spec": `InferShape`, `ShapeInput`, `HasShape` and `_shape` are now
  `InferSpec`, `SpecInput`, `HasSpec` and `_spec`. The `shape()` method and
  `shapeOnly` option are unchanged.
- c1164a8: Infer data types from schemas. `Infer<typeof shape | schema>` derives
  the object type from builders: `required()` and `default()` make a key
  non-optional, `nullable()` adds `null`, `inArray()` narrows to a literal
  union, and arrays, objects, `or()` and references carry their types.
  `Schema<S>`, `BuilderSchema<S>` and `BuilderObject<T>` are now generic over
  their shape.

  Breaking: schema references are lazy functions, not names.
  `sb.ref(() => schema)`, `sb.object().schema(() => schema)` and
  `sb.array().of(() => schema)` replace `sb.ref('name')`, `.schema('name')` and
  `.ofSchema('name')`, which are removed. The name is read when the schema is
  first used, so definition order and import cycles no longer matter. `mixed()`
  now infers `unknown`. `sb.array<T>()` and `sb.object<T>()` no longer take a
  type argument; the type comes from the argument.

### Minor Changes

- c1164a8: `applyDefaults` and `defaultsFor` always turn a string or number in a
  Date field into a Date, and the `cast` option is removed.
- c1164a8: `applyDefaults` and `defaultsFor` wrap a field declared with
  `construct(Class)` in that class, so a constructor no longer needs `transform`
  for it.
- c1164a8: `applyDefaults` and `defaultsFor` no longer take `overrides`. Declare
  a generated value on the schema with `.init(fn)`, or put the value in the
  field's `default()`.
- c1164a8: `applyDefaults` and `defaultsFor` no longer take `skip`. Leave the
  key out of the schema, or declare it with `.relation()` if it is populated
  related data.
- c1164a8: `applyDefaults` and `defaultsFor` no longer take `sparse` or
  `extras`. A key that is absent from the input stays absent, and populated
  related data is declared as a schema field with `.relation()`.
- c1164a8: Add `defaultsFor` (a compiled `applyDefaults`) and `init(value)`, a
  construct-time default that is never part of the spec, and options for
  `SchemaBuilder.applyDefaults` (`cast`, `skip`, `sparse`, `transform`,
  `extras`, `overrides`). Literal array and object defaults are now copied for
  each `applyDefaults` call instead of shared.
- c3b6ea1: Bound the work `validate`, `validatePaths` and `validateQuery` do on
  untrusted input. Arrays and objects with more than `maxCollectionSize` entries
  (default 10,000) are rejected with one error and no longer walked, a call
  visits at most `maxNodes` fields (default 1,000,000), and strict mode reports
  at most `maxFieldErrors` unspecified fields per object (default 100) plus a
  summary. Validation also runs in bounded batches instead of creating one
  pending promise per field, which previously used about 2.4 KB per field and
  could exhaust memory on a large payload. Set any limit to `Infinity` to
  restore the old behaviour. Filtering, private-field stripping and transient
  handling are not limited.
- d6da426: Tighten type casting and fix several validators.

  - Date: `''`, strings that cannot be parsed, Invalid Date, NaN timestamps and
    impossible calendar days such as `2026-02-30` are cast errors. The keyword
    `'now'` still gives the current time.
  - Boolean: accepts `true`, `false`, `1`, `0`, `on`, `off`, `yes` and `no`
    (trimmed, any case) and the numbers 1 and 0. Anything else, including `''`,
    is a cast error instead of `false`.
  - Number: `''`, whitespace, hex and octal strings, `NaN` and infinite values
    (string or number input) are cast errors. Trimmed plain decimal and exponent
    notation still work.
  - `notNull` no longer treats the strings `'null'`, `'Null'` and `'NULL'` as
    null. Pass `{ treatNullStringAsNull: true }` to restore the old behaviour.
  - `email` accepts top-level domains up to 63 characters (was 9).
  - `equality` fails when no `path` is configured and resolves dotted paths.
  - A null-prototype object in a String field is a validation error instead of a
    `TypeError`.
  - `ObjectPathAccessor.pathsMatch` now honours the escaped asterisk.

- c1164a8: `construct()` and `constructCollection()` accept a thunk
  (`() => Survey`) to break an import cycle, resolved when first used.
  `construct()` is also available on `sb.ref()` and `sb.mixed()`.
  `applyDefaults` and `defaultsFor` wrap each item of an array whose item
  builder has `construct()`. The `transform` option is removed, which leaves
  `applyDefaults`, `defaultsFor` and `SchemaConstructor.from` with no options
  argument and removes the `ApplyDefaultsOptions` type.
- c1164a8: Add `SchemaConstructor.from(SchemaX, options?)`, a base class whose
  instances are typed `Infer<SchemaX>` and filled through the schema's defaults,
  so a model is `class X extends SchemaConstructor.from(SchemaX) {}` with no
  interface merge.
- c1164a8: `SchemaConstructor.from` now types its input as raw data: new
  `InferInputSpec` makes every key optional and nullable, accepts constructed
  (`as<Class>()`) fields in plain-data form (`Plain`), and accepts `extras`
  keys, whose instance types come from their extractors (`ExtrasOf`,
  `ExtrasOutput`). The instance type is unchanged.
- c1164a8: Add a type-only `optional()` builder method that keeps an inferred
  key optional after `default()` or `required()`, for callers that build partial
  objects.
- c1164a8: Add a type-only `as<U>()` to the string builder, for a string field
  that stores a literal union the spec does not enforce.

### Patch Changes

- a5df4fa: Package descriptions on npm now say what each package does.
- c1164a8: Declare `$relation` on `SchemaSpec`, the flag `relation()` sets for
  populated related data that is stripped before persistence.
- 21f850e: Fix two validation bugs. The `stripHtml` filter took quadratic time
  on input with many unclosed `<` characters (100,000 of them blocked the event
  loop for over a minute), and because filters run before validators, a
  `maxLength` constraint did not prevent it. It now ignores everything after the
  last `>` and returns the same output as before. The `valueLength` validator
  rejected every number against `min` and `max` because its number comparison
  was inverted, and it ignored a limit of `0`. Numbers are now compared by value
  (`NaN` is rejected) and `min: 0` and `max: 0` are enforced.
- Updated dependencies [a5df4fa]
  - @datacapy/id@0.1.1

## 1.1.0

### Minor Changes

- dd068d4: `new Schema()` (and so a repo's `schema` option) now accepts a schema
  builder directly, building it at that point. A trailing `.build()` is no
  longer needed; `build()` remains for standalone specs.

## 1.0.0

### Major Changes

- 7966276: Field decryption is now opt-in on reads. `find` and `findOne` return
  encrypted fields as ciphertext unless the query passes `decrypt: true` or the
  field is declared `.encrypt({ eager: true })`; `Repo.decrypt(docs)` decrypts
  documents read without it, and `decrypt: true` propagates to populated
  relations. Writes skip values that are already encrypted envelopes when the
  service implements the new optional `isEncrypted()`
  (`SchemaEncryptionServiceRsa` does), so a document read without decryption can
  be written back without being encrypted twice. Migrate by adding
  `decrypt: true` to reads that need plaintext.

### Minor Changes

- 3633ccc: Field encryption key rotation. `SchemaEncryptionServiceRsa` accepts
  several keys (`keys` and `activeKeyId`), stamps each value with a key id in a
  `v: 2` envelope and reads old envelopes as key `default`. `rewrap()` moves a
  value to the active key without producing plaintext (optional on
  `SchemaEncryptionService`), and `EncryptionReencryptor` re-wraps a whole repo
  in batches, and a run can be repeated or resumed safely.

## 0.2.0

### Minor Changes

- a3415b9: Breaking: an empty array is now a value, not a missing one. The
  `default` filter only applies to `undefined` and `null`, so an explicit `[]`
  is kept on a field with a configured default. A missing array field still
  takes the configured default, or `[]` when none is set.

## 0.1.1

### Patch Changes

- b184196: Reject `__proto__`, `constructor` and `prototype` as path segments in
  `ObjectPathAccessor`, `SchemaIterator.mapField` and the Redis data source's
  nested update paths, closing the prototype-pollution code scanning alerts.

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this
baseline starts changelog tracking via
[Changesets](https://github.com/changesets/changesets).
