# @datacapy/codegen

Generates DataCapy schemas from TypeScript interfaces that carry [type tags](../schema/docs/tags.md). The interface is the only hand-edited input; the `*.schema.ts` module beside it is generated, checked in, and ends with a compile-time check that it infers exactly the interface.

```ts
/** @schema note */
export interface NoteData {
  title: string & t.Default<'untitled'> & t.Trim & t.MaxLength<200>
}
```

becomes `note.schema.ts` with `export class SchemaNote extends Schema.from(sb.schema('note').shape({ ... })) {}`.

## Usage

```bash
# write or refresh generated files
datacapy-gen
# fail if a checked-in file is stale
datacapy-gen --check
# list every unsupported property across all marked interfaces; writes nothing
datacapy-gen --report
```

`typescript` is a peer dependency: the generator uses the consumer's compiler. It always checks with `strictNullChecks` on, so `T | null` and optional keys are read correctly even when the consumer builds without it.

## `datacapy.config.json`

All paths are relative to the file.

| Key            | Default            | Meaning                                                                            |
| -------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `tsconfig`     | `tsconfig.json`    | Program that describes the sources                                                 |
| `include`      | `["src/**/*.ts"]`  | Globs (`*`, `**`) of files to scan                                                 |
| `outDir`       | beside each source | Mirror generated files here                                                        |
| `marker`       | `schema`           | JSDoc tag that marks an interface                                                  |
| `schemaModule` | `@datacapy/schema` | Module that exports `Schema`, `SchemaBuilder`, `SpecFor` and `AssertSchema`        |
| `strict`       | `false`            | Emit `.strict()` on every schema; `no-strict` in a marker overrides it             |
| `collections`  | `{}`               | `{ schemaName: CollectionClass }`, emitted as `.constructCollection('Name')`       |
| `registry`     | none               | Module exporting `validators`, `filters` and `initialisers`                        |
| `importMap`    | `{}`               | `{ Interface: { schema, type } }` import specifiers for schemas in another package |

## Documentation

| Page                                                                             | Content                                                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Guide](docs/guide.md)                                                           | Interface to generated schema, CI and pre-commit wiring, adopting one schema at a time |
| [Type mapping](docs/type-mapping.md)                                             | Supported types, presence rules, chain order, unsupported constructs and errors        |
| [Architecture](docs/architecture.md)                                             | Pipeline, class roles, adding a tag, tests                                             |
| [Type tags](../schema/docs/tags.md)                                              | What each tag means                                                                    |
| [Decision record](../../docs/decisions/2026/2026-11-12_tag-schema-generation.md) | Why the interface is the source of truth                                               |

## Marker options

`/** @schema name construct=Name strict */` sets the constructor and strictness of one schema. See the [guide](docs/guide.md#schema-options).

## Callbacks

`t.Validate<'name'>` and `t.Filter<'name'>` generate `.validate(validators.name)` and `.filter(filters.name)`. `t.InitFn<'name'>` and `t.DefaultFn<'name'>` generate `.init(initialisers.name)` and `.default(initialisers.name)`. Name a `registry` module in the config that exports `validators`, `filters` and `initialisers` objects of functions. One registry per package keeps unrelated projects apart. A schema in another package is found through `importMap`.

## Pre-commit

`datacapy-gen --staged <files>` regenerates the packages that have a staged file carrying the marker and stages the output. Wire it into lint-staged:

```json
{ "lint-staged": { "**/*.ts": "datacapy-gen --staged" } }
```

The output is formatted with the consumer's own Prettier and config when it is installed, so a formatting hook never makes a checked-in file look stale.
