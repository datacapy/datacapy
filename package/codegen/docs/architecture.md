# Architecture

`datacapy-gen` is a pipeline from a TypeScript program to formatted source text. Each stage is one class in `src/`.

```
datacapy.config.json
        │  ConfigLoader (config.ts)
        ▼
ts.Program (strictNullChecks forced on)
        │  SchemaGenerator finds @schema interfaces
        ▼
TypeAnalyser (type-analyser.ts)   checker type  →  FieldModel
        │
        ▼
BuilderEmitter (builder-emitter.ts)   FieldModel  →  sb chain + EmitContext imports
        │
        ▼
Formatter (formatter.ts)   consumer's Prettier, child process
        │
        ▼
generate() / write() / check()   cli.ts: --check, --report, --config, --staged
```

## Roles

| Class             | Job                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ConfigLoader`    | Reads and validates `datacapy.config.json`, resolves paths                                                        |
| `SchemaGenerator` | Builds the program, discovers marked interfaces, resolves references, renders files                               |
| `TypeAnalyser`    | Splits a property type into base kind, `null`, optionality and tags                                               |
| `BuilderEmitter`  | Writes the chain in a fixed order and records the imports the file needs                                          |
| `Formatter`       | Formats output with the consumer's Prettier; in a child process because Prettier cannot run in-process under Jest |
| `GeneratorError`  | Carries the property path in the message                                                                          |

`FieldModel` (`field-model.ts`) is the only contract between analyser and emitter.

## Adding a tag

1. Export the type in `package/schema/src/tags/tags.ts` with a unique `$dc:` key.
2. Add it to `FLAG_TAGS` or `VALUE_TAGS` in `builder-emitter.ts` (order there is emit order); `KNOWN_TAGS` follows. A tag with its own rules (`InitFn`, `DefaultFn`, `ConstructCollection`) gets a dedicated method in `BuilderEmitter` instead.
3. Add the row to [tags.md](../../schema/docs/tags.md), then a property to a fixture and regenerate the golden file.

## Adding a base type

Add a `BaseKind` variant (`map` and `opaque` are the latest), produce it in `TypeAnalyser.baseKind`, and emit it in `BuilderEmitter.constructorCall`. The compiler's exhaustive `switch` flags a missing case.

## Tests

- Golden files: `fixtures/{note,shapes,options,maps}/src/*.schema.ts` are checked in and compared with fresh output.
- A compile check builds each fixture with `strictNullChecks` on to prove the generated schema infers exactly the interface, including an import cycle.
- Temporary projects cover `--check`, `--staged`, `--report`, `outDir`, `importMap`, marker options and each error.
- `options` and `maps` also run the generated schema: a strict schema rejects an unknown key, and a `matchAll` schema validates each entry.
- `tags-doc.test.ts` compares the tag names in `tags.md` with the exported tag types.

Regenerate the golden files after an emitter change (from `package/codegen`):

```bash
node -e "require('ts-node/register/transpile-only');const {ConfigLoader}=require('./src/config');const {SchemaGenerator}=require('./src/schema-generator');(async()=>{for (const f of ['note','shapes','options','maps']) await new SchemaGenerator(new ConfigLoader().load('fixtures/'+f)).write()})()"
```

Decisions behind this design: [ADR](../../../docs/decisions/2026/2026-11-12_tag-schema-generation.md).
