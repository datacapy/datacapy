# Type tags and exactness checks

Tags describe schema rules on a TypeScript interface. They are type-only:
nothing exists at runtime and nothing is added to the bundle. A generator
([`@datacapy/codegen`](../../codegen/README.md)) reads them and writes the
matching `sb.schema(...)` module.

```ts
import type { tags as t } from '@datacapy/schema'

/** @schema note */
export interface NoteData {
  title: string & t.Default<'untitled'> & t.Trim & t.MaxLength<200>
  email?: string & t.Email & t.Encrypt
  status: 'draft' | 'published'
}
```

Each tag is an optional phantom property, so plain data stays assignable:
`const s: string & t.Trim = 'x'` compiles.

## Tags

| Tag                                                                    | Builder method                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Default<V>`, `Init<V>`                                                | `default(V)`, `init(V)`                                                         |
| `Email`, `Pattern<P>`, `MinLength<N>`, `MaxLength<N>`, `NotEmpty`      | `email()`, `regex(P)`, `minLength(N)`, `maxLength(N)`, `notEmpty()`             |
| `Trim`, `Lowercase`, `Uppercase`, `StripHtml`                          | the filter of the same name                                                     |
| `Private`, `PrivateValue`, `Encrypt`, `Label<L>`, `Relation`, `NoCast` | the method of the same name                                                     |
| `InitFn<Name>`, `DefaultFn<Name>`                                      | `init(initialisers.Name)`, `default(initialisers.Name)`                         |
| `ConstructCollection<Name>`                                            | `constructCollection('Name')`, arrays only                                      |
| `Validate<Name>`, `Filter<Name>`                                       | `validate(validators.Name)`, `filter(filters.Name)` from the package's registry |

Arguments must be literal types. In the generated chain the tags appear in a
fixed order, listed in the
[type mapping](../../codegen/docs/type-mapping.md#chain-order). Presence follows
the key: a non-optional key without `Default` or `Init` becomes `required()`;
`key?: T & Default<V>` becomes `.default(V).optional()`.

## Exactness checks

`SpecFor<T>` is the plain type an interface describes, with every tag removed.
`AssertSpec<S, T>` and `AssertSchema<X, T>` resolve to `true` when a spec (or
schema class) infers exactly that type, and to an error object that shows both
types otherwise.

```ts
const _check: AssertSchema<SchemaNote, NoteData> = true // fails to compile on drift
```

Use them to verify a hand-written schema against its interface, which is also
the first step of adopting tags (see the
[guide](../../codegen/docs/guide.md#adopt-one-schema-at-a-time)). The generator
emits the same check at the end of each file.

## Semantics

- `Default<V>`: used when the field is missing. `Default<null>` also makes the
  field nullable.
- `Init<V>`: set once on insert; the key needs no `required()`.
- `Label<L>`: the name used in validation error messages.
- `Private`, `PrivateValue`: removed by `filterPrivate` (see
  [filtering](filtering.md#private-fields)).
- `Encrypt`: marks the field for the encryption service (see
  [encryption](encryption.md)).
- `Relation`: related data loaded from elsewhere, never stored with the record
  (see [composition](composition.md#relations)).
- `NoCast`: skips type-casting, and children inherit it.
- `InitFn<Name>`, `DefaultFn<Name>`: like `Init` and `Default`, but the value is
  a function looked up by name in the registry's `initialisers` export. Do not
  combine with the literal tag for the same slot.
- `ConstructCollection<Name>`: on an array (a property or an element of an outer
  array), names the collection class the runtime wraps it in. Any other base
  type fails the run.
- `Validate<Name>`, `Filter<Name>`: call a function by name from the package's
  registry.

## Worked example

```ts
/** @schema note */
export interface NoteData {
  title: string & t.Default<'untitled'> & t.MaxLength<200>
  closedAt: (Date & t.Default<null>) | null
}

type Plain = SpecFor<NoteData> // { title: string; closedAt: Date | null }
```

`SpecFor` drops the tags, so `Plain` is what the schema infers and what
`AssertSchema` compares against. The generated chain for each property is in the
[type mapping](../../codegen/docs/type-mapping.md#presence-and-nullability).
