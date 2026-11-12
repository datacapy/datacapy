# Guide: define a schema by interface

Walkthrough from interface to checked-in schema, then CI and pre-commit wiring. Reference: [type mapping](type-mapping.md), [tags](../../schema/docs/tags.md).

## 1. Install and configure

```bash
pnpm add -D @datacapy/codegen
```

`datacapy.config.json` beside the package's `tsconfig.json`; every key is optional (see the [README](../README.md#datacapyconfigjson)):

```json
{ "include": ["src/**/*.ts"] }
```

## 2. Write the interface

Mark it with `@schema <name>`. The name is the schema name passed to `sb.schema(...)`.

```ts
import type { tags as t } from '@datacapy/schema'

/** @schema note */
export interface NoteData {
  title: string & t.Default<'untitled'> & t.Trim & t.MaxLength<200>
  status: 'draft' | 'published'
}
```

### Schema options

The marker takes two optional words after the name:

```ts
/** @schema survey construct=Survey strict */
```

- `construct=<Name>` emits `.construct('Name')`. The constructor is looked up by name at runtime, so the generated file imports nothing.
- `strict` emits `.strict()`, which rejects unknown keys. `no-strict` turns it off for one interface when `"strict": true` is set in `datacapy.config.json`.

A collection constructor is set in `datacapy.config.json`, not the marker: `"collections": { "survey": "SurveyCollection" }` emits `.constructCollection('SurveyCollection')`, with or without `construct=`.

The order is always `sb.schema('x').construct('X').constructCollection('XCollection').strict().shape({...})`. Any other word fails the run. A third option belongs in the config file, not the marker.

### Describe a class instead

Put the marker on a class and the class is the model. Its data fields become the schema; the schema is generated and nothing in your code imports it by hand.

```ts
import { SchemaConstructorBase } from '@datacapy/schema'

/** @schema note strict */
export class Note extends SchemaConstructorBase<Note> {
  _id?: string
  text!: string & t.Trim & t.MinLength<1> & t.MaxLength<280>
  owner?: string

  greeting() {
    return `Hello, ${this.owner}`
  }
}
```

- The schema gets `.construct('Note')` from the class name, so `construct=` is omitted (a different value is an error). `strict`, `no-strict` and the config `collections` map work as for interfaces.
- Only data fields are read, including inherited ones. Methods, accessors, statics and `private` or `protected` members are left out.
- `SchemaConstructorBase<Note>` copies the constructor data onto the instance and nothing else. It does not fill defaults: they come from `validate()` or `applyDefaults`. A class that needs more writes its own constructor and skips the base.
- Declare fields with `!` or `declare`, and set `useDefineForClassFields` to `false` in the tsconfig, or the subclass field declarations reset the values the base just copied.
- Hydration by name is unchanged: register the class and the generated schema with the `ModelManager` (or `schema.addConstructors`).

## 3. Generate

```bash
datacapy-gen
```

This writes `note.schema.ts` beside the source, formatted with your Prettier. It exports `SchemaNote` and ends with `AssertSchema<SchemaNote, NoteData>`, so the build fails if the two ever disagree. Commit the file; never edit it.

## 4. Keep it fresh

Add scripts and chain the check into lint:

```json
{
  "scripts": {
    "gen": "datacapy-gen",
    "gen:check": "datacapy-gen --check",
    "lint": "pnpm gen:check && eslint ."
  },
  "lint-staged": { "**/*.ts": "datacapy-gen --staged" }
}
```

`--report` tries every marked interface, prints each unsupported property path (not just the first) and writes nothing. Use it to size a migration. `--check` exits non-zero and lists stale or missing files. `--staged` regenerates only packages with a staged file that carries the marker, then stages the output.

## Adopt one schema at a time

1. Write the interface for an existing hand-written schema and add `AssertSchema<SchemaX, XData>` beside it. Drift now fails the build; nothing is generated yet.
2. Commit an equivalence test that snapshots the schema's behaviour.
3. Add the `@schema` marker, delete the hand-written module and run `datacapy-gen`. The equivalence test must still pass.
