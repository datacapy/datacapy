# Schema builder

`SchemaBuilder` is a fluent builder for schema specs. Import it under the local
alias `sb` (`import { SchemaBuilder as sb }`); the examples below use that
alias. Each `sb.<type>()` call returns a builder; methods add rules and return
the builder. `new Schema()` accepts a builder directly; `.build()` produces the
equivalent plain spec.

```ts
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'

const schema = new Schema(
  sb.schema('user').shape({
    name: sb.string().required().maxLength(64),
    age: sb.number(),
  })
)
```

Nested builders are built for you: pass them to `shape()`, `sb.object()`,
`sb.array()` and `sb.or()` without calling `.build()` on each. The outermost
builder needs no `.build()` either when passed to `new Schema()` or a repo's
`schema` option; call it only to get a plain spec.

## Creating builders

| Call                   | Field type       | Notes                                                      |
| ---------------------- | ---------------- | ---------------------------------------------------------- |
| `sb.string()`          | `String`         | String rules and filters                                   |
| `sb.number()`          | `Number`         | Base methods only                                          |
| `sb.boolean()`         | `Boolean`        | Base methods only                                          |
| `sb.date()`            | `Date`           | Base methods only. `default('now')` gives the current time |
| `sb.array(items?)`     | `Array`          | `items` is a builder or spec for each element              |
| `sb.object(spec?)`     | `Object`         | `spec` maps field names to builders or specs               |
| `sb.mixed()`           | Any              | No casting, accepts any value                              |
| `sb.or([a, b])`        | One of several   | See [Composition](composition.md#alternatives-with-or)     |
| `sb.schema(name?)`     | Top-level schema | Names the schema and holds its fields                      |
| `sb.ref(() => schema)` | Schema reference | Lazy; see [Composition](composition.md#schema-references)  |

`sb.number()`, `sb.boolean()` and `sb.date()` have no range or format methods.
Use a custom [`validate()`](validation.md#custom-rules) callback for those.

## Base methods (all field builders)

| Method                                   | Effect                                                     | Guide                                                    |
| ---------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `required(opts?)`                        | Value must be present                                      | [Validation](validation.md)                              |
| `notNull(opts?)`                         | Value must not be `null`                                   | [Validation](validation.md)                              |
| `notEmpty(opts?)`                        | Value must not be empty (`''`, `[]`)                       | [Validation](validation.md)                              |
| `isEmpty(opts?)`                         | Value must be empty                                        | [Validation](validation.md)                              |
| `validate(fn, opts?)`                    | Custom rule, callable more than once                       | [Validation](validation.md#custom-rules)                 |
| `nullable()`                             | An object field may be `null`                              | [Validation](validation.md#null-and-empty-values)        |
| `noCast(value = true)`                   | Skip type-casting for this field and its `matchAll` values | [Validation](validation.md#type-casting)                 |
| `label(text)`                            | Name used in error messages                                | [Validation](validation.md#error-messages)               |
| `default(value)`                         | Value used when the field is `undefined`                   | [Filtering](filtering.md#defaults)                       |
| `filter(fn)`                             | Custom filter function                                     | [Filtering](filtering.md#custom-and-conditional-filters) |
| `filterIf(name, condition, config?)`     | Apply a named filter only when a condition holds           | [Filtering](filtering.md#custom-and-conditional-filters) |
| `private(mode?)` / `privateValue(mode?)` | Hide the field or its value                                | [Filtering](filtering.md#private-fields)                 |
| `encrypt()`                              | Mark for at-rest encryption                                | [Encryption](encryption.md)                              |
| `relation(value = true)`                 | Mark as related data, not stored                           | [Composition](composition.md#relations)                  |

`opts` is `{ name?: string, message?: string }`: a custom error message and an
identifier for the rule.

## String methods

| Method                                               | Kind     | Effect                                          |
| ---------------------------------------------------- | -------- | ----------------------------------------------- |
| `email(opts?)`                                       | Validate | Must look like an email address                 |
| `minLength(n)` / `maxLength(n)` / `length(min, max)` | Validate | Length limits                                   |
| `regex(pattern, opts?)`                              | Validate | Must match. Call repeatedly to combine patterns |
| `inArray(values, opts?)`                             | Validate | Must be one of `values`                         |
| `trim()`                                             | Filter   | Remove leading and trailing whitespace          |
| `uppercase()` / `lowercase()`                        | Filter   | Change case                                     |
| `stripHtml()`                                        | Filter   | Remove HTML tags                                |
| `prependHttpIfMissing()`                             | Filter   | Add `http://` when there is no scheme           |

## Array, object and schema methods

| Builder       | Method                                                                                    | Effect                                                          |
| ------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Array         | `of(item)`                                                                                | Element spec or builder (same as the constructor argument)      |
| Object        | `shape(fields)`                                                                           | Define fields (same as the constructor argument)                |
| Object        | `schema(() => schema)`                                                                    | Object is validated by the referenced schema                    |
| Object        | `matchAll(spec)`                                                                          | Spec applied to every key of the object, for dynamic keys       |
| Object        | `strict(value = true)`                                                                    | Reject undeclared fields                                        |
| Array, Object | `construct(Class)` / `constructCollection(Class)`                                         | Build instances. See [Composition](composition.md#constructors) |
| `sb.schema()` | `name`, `shape`, `strict`, `matchAll`, `construct`, `constructCollection`, `extend(spec)` | Same as above. `extend` merges in an existing spec              |

## Filling defaults in a constructor

`sb.applyDefaults(spec, data, options?)` returns `data` with every missing key
set to its starting value, computed synchronously with no validation. A
constructor can then state its defaults once, in the schema spec:

```ts
constructor(data: Partial<Note> = {}) {
  Object.assign(this, sb.applyDefaults(noteSpec, data))
}
```

A key takes its `default()` value, else its `init()` value. `init(value)` is a
construct-time default that never enters the spec, so validation is unchanged.
Use it where `default()` would loosen the schema: `required()` plus `default()`
accepts a missing value, but `required().init('')` still rejects it. A literal
array or object default is copied for each call, and a function default is
called each time.

`sb.defaultsFor(spec, options)` does the work that depends only on the schema
spec and options once and returns the function. Build it at module level for a
constructor that runs often: `applyDefaults` rebuilds that plan on every call.
The returned function also takes a second argument, an object to fill in place
(`fillDefaults(data, this)`), which saves building and copying a result.

`SchemaConstructor.from(SchemaX, options)` wraps this for a model class (input
and output types: [Constructors and raw data](constructors.md)). The class is
its schema's fields and nothing else, with no interface merge:

```ts
class Note extends SchemaConstructor.from(SchemaNote) {
  label() {
    return `${this.title}!`
  }
}
```

Instances are typed `Infer<SchemaNote>` and `new Note(data)` takes raw data (see
[Constructors and raw data](constructors.md)). A subclass field declared without
an initialiser is reset to `undefined` when `useDefineForClassFields` is on (the
default for targets ES2022 and later), so declare behaviour as methods only.

`undefined` and `null` count as missing, as in the `default()` filter; `''`, `0`
and `false` are kept. A Date field turns a string or number into a Date and
keeps `null`. Other keys pass through, and an unset key stays absent. A field
declared with `construct(Class)` is wrapped as `new Class(value)` when it has a
value, and `null` stays `null`. On an array field, `construct()` on the item
builder wraps each item. Pass a thunk, `construct(() => Survey)`, when the class
and the schema import each other; it is resolved on the first call, not when the
schema is declared. A `construct('Name')` string is left to the repo to resolve.

Populated related data (a count, a joined record) is a schema field marked
`.relation()`, such as `responseCount: sb.number().relation()`. It is optional
on the instance, stays absent when the input has none, and is stripped before
persistence.

## The plain spec form

`.build()` returns a plain object. Option names starting with `$` configure the
field; every other key is a child field. The builder above is equivalent to:

```ts
const schema = new Schema({
  $name: 'user',
  name: {
    $type: String,
    $validate: { required: true, valueLength: { max: 64 } },
  },
  age: { $type: Number },
})
```

Shorthand also works in plain specs: `age: Number` is the same as
`age: { $type: Number }`, and `'string'` is accepted as a type name.

| Option                               | Set by                           | Meaning                                                                       |
| ------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| `$name`                              | `sb.schema(name)`                | Schema name, used by references                                               |
| `$type`                              | `sb.string()` etc.               | Field type: `String`, `Number`, `Boolean`, `Date`, `Array`, `Object`, `Mixed` |
| `$validate`                          | Validation methods               | Validator configuration                                                       |
| `$filter`                            | Filter methods                   | Filter configuration                                                          |
| `$label`                             | `label()`                        | Error message name                                                            |
| `$strict`                            | `strict()`                       | Reject undeclared fields, inherited by children                               |
| `$nullable`                          | `nullable()`                     | Object may be `null`                                                          |
| `$noCast`                            | `noCast()`                       | Skip type-casting for the field and its `matchAll` values                     |
| `$spec`                              | `sb.array(item)`                 | Element spec for an array                                                     |
| `$schema`                            | `sb.ref()`, `.schema()`, `.of()` | Reference to a schema, read lazily                                            |
| `$or`                                | `sb.or()`                        | Alternative specs                                                             |
| `$construct`, `$constructCollection` | `construct()`                    | Class to instantiate                                                          |
| `*`                                  | `matchAll()`                     | Spec applied to every key, for dynamic keys                                   |

## Inferring types

The schema is the single source of a model's data type. `Infer` reads it, so the
type is not written a second time:

```ts
import { Infer, Schema, SchemaBuilder as sb } from '@datacapy/schema'

export class SchemaNote extends Schema.from(
  sb.schema('note').shape({
    _id: sb.string().required(),
    text: sb.string().required().trim().length(1, 280),
    owner: sb.string(),
    pinned: sb.boolean().default(false),
  })
) {}

export type Note = Infer<SchemaNote>
// { _id: string; text: string; pinned: boolean; owner?: string }
```

`Schema.from(builderSchema)` returns a base class typed with the schema spec, so
a schema needs no separate exported spec object. `Infer` accepts a `Schema` (the
class instance type), a `BuilderSchema`, a schema spec made of builders (a plain
object of builders) or a single builder. `sb.defaultsFor()` takes the same: a
schema class, a schema instance or a spec of builders.

| Builder call                | Effect on the type                                               |
| --------------------------- | ---------------------------------------------------------------- |
| `required()`, `default(v)`  | The key is required. Without either it is optional (`key?: T`)   |
| `optional()`                | Keeps the key optional after `default()`/`required()`; type only |
| `nullable()`                | Adds `\| null`                                                   |
| `string().inArray([...])`   | Narrows to the literal union                                     |
| `array(item)`, `.of(item)`  | `T[]`, with `T` inferred from a builder, spec or reference       |
| `object(spec)`, `.shape()`  | The inferred object type                                         |
| `or([a, b])`                | The union of the alternatives                                    |
| `ref(() => s)`, `.schema()` | The referenced schema's inferred type                            |
| `object().matchAll(spec)`   | `Record<string, T>`, with `T` inferred from `spec`               |
| `as<T>()`                   | States the type; no runtime effect. See below                    |
| `mixed()`                   | `unknown`; `mixed().as<T>()` states a type (no runtime effect)   |

`required()` is both a validator and the type marker, so a field the type calls
non-optional must say so in the schema. A plain spec object
(`{ $type: String }`) has no type information and infers `any`.

**Stating a type with `as<T>()`.** When a spec cannot express the type,
`as<T>()` on an object, array, mixed or string builder sets it without changing
the spec. A bare `object()` or `array()` infers `any`, so state the type. On a
string, `as<U extends string>()` narrows to a literal union that the spec does
not enforce (use `inArray` when it should be validated).

```ts
const spec = {
  options: sb.object().as<Record<string, unknown>>().default({}),
  kind: sb.string().maxLength(16).as<'a' | 'b'>().default('a'),
  label: sb.object().matchAll(sb.string()).as<L10n>().default({}),
}
```

Put `as<T>()` after the calls that change the type (`shape`, `schema`,
`matchAll`, `of`), because each of those replaces it. A string builder returned
by `as` has no string methods, so call `maxLength`, `trim` and the rest first.
The `required`, `default`, `nullable` and `optional` markers carry across `as`
in either order.

`new Schema(...)` is generic over its schema spec, so `Infer<typeof schema>`
works on a built schema too. Prefer `Schema.from()` for a named schema class;
extend `Schema<typeof noteSpec>` directly only when the spec is shared
elsewhere.

**Recursive schemas** (a section containing sections) hit TypeScript's
"implicitly has type 'any' because it is referenced in its own initializer".
Break the loop with one annotation on the schema constant, as in
`src/builder/infer.type-test.ts`. Non-recursive references infer without any.

Type tests live in `*.type-test.ts` files and run with `pnpm typecheck`.

Use the builder by default. Reach for a plain spec when a schema is generated or
loaded as data, or to use a `$` option the builder does not expose.
