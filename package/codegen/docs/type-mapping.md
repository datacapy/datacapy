# Type mapping

How `datacapy-gen` turns an interface property into a builder chain. Source: `src/type-analyser.ts` (type to model) and `src/builder-emitter.ts` (model to chain). Tags are listed in [tags.md](../../schema/docs/tags.md).

## Base types

| TypeScript                                 | Builder                                                |
| ------------------------------------------ | ------------------------------------------------------ |
| `string`                                   | `sb.string()`                                          |
| `'a' \| 'b'`                               | `sb.string().inArray(['a', 'b'])`                      |
| `number`                                   | `sb.number()`                                          |
| `boolean`                                  | `sb.boolean()`                                         |
| `Date`                                     | `sb.date()`                                            |
| `unknown`                                  | `sb.mixed()`                                           |
| `T[]`                                      | `sb.array(<T>)`; items are always `required()`         |
| `{ a: string }`                            | `sb.object({ a: ... })`                                |
| `{ [k: string]: V }`, `Record<string, V>`  | `sb.object().matchAll(<V>)`; entries carry no presence |
| `Record<string, unknown>`                  | `sb.object().as<Record<string, unknown>>()`            |
| `object`                                   | `sb.object().as<object>()`                             |
| `A \| B` (objects or `@schema` interfaces) | `sb.or([<A>, <B>])`; members carry no presence         |
| Another `@schema` interface                | `sb.refTo<SpecFor<X>>((): unknown => new SchemaX())`   |

## Presence and nullability

| Property                            | Chain                              |
| ----------------------------------- | ---------------------------------- |
| `a: string`                         | `.required()`                      |
| `a?: string`                        | no presence call                   |
| `a: string & Default<'x'>`          | `.default('x')`                    |
| `a?: string & Default<'x'>`         | `.default('x').optional()`         |
| `a: string & Init<'x'>`             | `.init('x')` (no `required()`)     |
| `a: string \| null`                 | `.required().nullable()`           |
| `a: (Date & Default<null>) \| null` | `.default(null)` (no `nullable()`) |

## Chain order

Fixed, because the order of intersection members is unreliable in the checker:

1. presence: `required()`, `default()`, `init()` (`t.Required` adds `required()` beside the other two)
2. base refinement: `inArray()` (a literal union, or `t.OneOf<...>` on a plain `string`)
3. `constructCollection('Name')` for `ConstructCollection<Name>` on an array
4. tags with a value: `regex`, `minLength`, `maxLength`, `label`
5. flag tags: `email`, `notEmpty`, `trim`, `lowercase`, `uppercase`, `stripHtml`, `private`, `privateValue`, `encrypt`, `noCast`, `relation`
6. callbacks: `validate(validators.x)`, `filter(filters.x)`; `InitFn` and `DefaultFn` take the place of `init` and `default` as `init(initialisers.x)`, `default(initialisers.x)`
7. `nullable()`, then `optional()`

## Classes

A `@schema` class is read like an interface, restricted to its data fields. The generated check compares the schema with those fields only: `AssertSchema<SchemaNote, Pick<Note, 'text' | 'owner'>>`. Methods, getters, `private` and `protected` members and statics are not fields. The schema is constructed by the class name.

## Schema options

`/** @schema name construct=Name strict */` adds `.construct('Name')` and `.strict()` before `.shape(...)`. The `collections` config map (schema name to collection class name) adds `.constructCollection('Name')` between them. `strict` defaults from the `strict` config key (false if unset) and `no-strict` overrides it per interface. Unknown options and an empty or invalid `construct=` fail the run.

An interface whose only member is a string index signature, marked `@schema`, emits `sb.schema('x')....matchAll(<V>)` with no `shape`. This is how a localised string (`L10n`) is described. `Record<string, unknown>` is deliberately opaque rather than `matchAll(sb.mixed())`.

## Not supported yet

Numeric literal unions, tuples, `Map`, index signatures mixed with named properties, numeric keys, `sb.mixed` with tags, and `Date` ranges. An unsupported type fails the run and names the property path, for example `NoteData.meta: unsupported type Map<string, string>`. An unknown tag, a tag argument that is not a literal, and `Validate`, `Filter`, `InitFn` or `DefaultFn` without a `registry` fail the same way.

## Keeping this page honest

`src/tags-doc.test.ts` compares the tag names in `tags.md` with the exported tag types.
