# Schema builder

`sb` is a fluent builder for schema specs. Each `sb.<type>()` call returns a
builder; methods add rules and return the builder, and `.build()` produces the
spec that `new Schema()` accepts.

```ts
import { Schema, sb } from '@datacapy/schema'

const schema = new Schema(
  sb
    .schema('user')
    .shape({
      name: sb.string().required().maxLength(64),
      age: sb.number(),
    })
    .build()
)
```

Nested builders are built for you: pass them to `shape()`, `sb.object()`,
`sb.array()` and `sb.or()` without calling `.build()` on each. Only the
outermost builder needs `.build()`.

## Creating builders

| Call                | Field type       | Notes                                                                            |
| ------------------- | ---------------- | -------------------------------------------------------------------------------- |
| `sb.string()`       | `String`         | String rules and filters                                                         |
| `sb.number()`       | `Number`         | Base methods only                                                                |
| `sb.boolean()`      | `Boolean`        | Base methods only                                                                |
| `sb.date()`         | `Date`           | Base methods only. `default('now')` gives the current time                       |
| `sb.array(items?)`  | `Array`          | `items` is a builder or spec for each element                                    |
| `sb.object(shape?)` | `Object`         | `shape` maps field names to builders or specs                                    |
| `sb.mixed()`        | Any              | No casting, accepts any value                                                    |
| `sb.or([a, b])`     | One of several   | See [Composition](composition.md#alternatives-with-or)                           |
| `sb.schema(name?)`  | Top-level schema | Names the schema and holds its fields                                            |
| `sb.ref(name)`      | Schema reference | Returns `{ $schema: name }`. See [Composition](composition.md#schema-references) |

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
| Array         | `ofSchema(name)`                                                                          | Elements are validated by the named schema                      |
| Object        | `shape(fields)`                                                                           | Define fields (same as the constructor argument)                |
| Object        | `schema(name)`                                                                            | Object is validated by the named schema                         |
| Object        | `matchAll(spec)`                                                                          | Spec applied to every key of the object, for dynamic keys       |
| Object        | `strict(value = true)`                                                                    | Reject undeclared fields                                        |
| Array, Object | `construct(Class)` / `constructCollection(Class)`                                         | Build instances. See [Composition](composition.md#constructors) |
| `sb.schema()` | `name`, `shape`, `strict`, `matchAll`, `construct`, `constructCollection`, `extend(spec)` | Same as above. `extend` merges in an existing spec              |

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

| Option                               | Set by                                 | Meaning                                                                       |
| ------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| `$name`                              | `sb.schema(name)`                      | Schema name, used by references                                               |
| `$type`                              | `sb.string()` etc.                     | Field type: `String`, `Number`, `Boolean`, `Date`, `Array`, `Object`, `Mixed` |
| `$validate`                          | Validation methods                     | Validator configuration                                                       |
| `$filter`                            | Filter methods                         | Filter configuration                                                          |
| `$label`                             | `label()`                              | Error message name                                                            |
| `$strict`                            | `strict()`                             | Reject undeclared fields, inherited by children                               |
| `$nullable`                          | `nullable()`                           | Object may be `null`                                                          |
| `$noCast`                            | `noCast()`                             | Skip type-casting for the field and its `matchAll` values                     |
| `$spec`                              | `sb.array(item)`                       | Element spec for an array                                                     |
| `$schema`                            | `sb.ref()`, `.schema()`, `.ofSchema()` | Reference to a named schema                                                   |
| `$or`                                | `sb.or()`                              | Alternative specs                                                             |
| `$construct`, `$constructCollection` | `construct()`                          | Class to instantiate                                                          |
| `*`                                  | `matchAll()`                           | Spec applied to every key, for dynamic keys                                   |

Use the builder by default. Reach for a plain spec when a schema is generated or
loaded as data, or to use a `$` option the builder does not expose.
