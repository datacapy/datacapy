# Filtering

Filters change a value: fill a default, tidy a string, hide a field.
`validate()` runs them before the rules, so validation sees the filtered value.
To run filters without validating, use `applyFilters()`.

```ts
import { Schema, sb } from '@datacapy/schema'

const schema = new Schema(
  sb
    .schema()
    .shape({
      email: sb.string().trim().lowercase().email(),
      status: sb.string().default('draft'),
    })
    .build()
)

const data = { email: '  Kevin@Example.COM ' }
await schema.applyFilters(data)
// { email: 'kevin@example.com', status: 'draft' }
```

## Defaults

`default(value)` replaces a value that is `undefined`, `null` or an empty array.
Pass a function to compute the default each time. The default is type-cast to
the field type, so `sb.date().default('now')` gives a `Date`.

```ts
sb.string().default('draft')
sb.date().default('now')
sb.string().default(() => crypto.randomUUID())
```

Object fields default to `{}` and array fields to `[]` without any
configuration. A `String` field named `_id` defaults to a new
[`@datacapy/id`](../../mzen-id/README.md) value.

## String filters

| Method                   | Example input       | Result                 |
| ------------------------ | ------------------- | ---------------------- |
| `trim()`                 | `'  a '`            | `'a'`                  |
| `uppercase()`            | `'ab1'`             | `'AB1'`                |
| `lowercase()`            | `'AB1'`             | `'ab1'`                |
| `stripHtml()`            | `'<b>Hi</b> there'` | `'Hi there'`           |
| `prependHttpIfMissing()` | `'example.com'`     | `'http://example.com'` |

Filters run in the order you chain them, after any default has been applied.

## Custom and conditional filters

`filter(fn)` takes a function that receives the value and returns the new value.
It runs for absent values too, so handle `undefined`.

```ts
sb.string().filter((value) =>
  typeof value === 'string' ? value.replace(/\s+/g, '-') : value
)
```

`filterIf(name, condition, config?)` applies a built-in filter only when the
value meets a condition. Conditions are `{ $regex }` and `{ $not: condition }`.

```ts
// Uppercase a reference only if it starts with a letter
sb.string().filterIf('uppercase', { $regex: /^[a-z]/ })
// 'abc' -> 'ABC', '9bc' -> '9bc'
```

## `applyFilters` and `applyFiltersPaths`

`applyFilters(object)` walks the whole schema, so it fills defaults for fields
the object lacks. `applyFiltersPaths(paths)` walks only the fields present,
which suits partial updates where absent fields must stay absent.

```ts
const schema = new Schema(
  sb
    .schema()
    .shape({
      name: sb.string().trim(),
      status: sb.string().default('draft'),
    })
    .build()
)

await schema.applyFilters({ name: ' a ' }) // { name: 'a', status: 'draft' }
await schema.applyFiltersPaths({ name: ' a ' }) // { name: 'a' }
```

Both modify the object in place and return it.

## Private fields

Private fields exist in your data but must not leave it, for example a password
hash in an API response. `filterPrivate(object, mode?)` removes them in place
and returns the object.

| Method                                 | Effect on `filterPrivate`                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `private()`                            | Field is removed                                                                          |
| `privateValue()`                       | Field is kept, its value becomes `true` (the caller can tell it is set without seeing it) |
| `private('read')` / `private('write')` | Removed only when `filterPrivate` is called with that mode                                |

```ts
const schema = new Schema(
  sb
    .schema()
    .shape({
      name: sb.string(),
      passwordHash: sb.string().private(),
      pin: sb.string().privateValue(),
      internal: sb.string().private('read'),
      profile: sb.object({
        ssn: sb.string().private(),
        city: sb.string(),
      }),
    })
    .build()
)

const record = () => ({
  name: 'a',
  passwordHash: 'x',
  pin: '1234',
  internal: 'i',
  profile: { ssn: 's', city: 'c' },
})

schema.filterPrivate(record())
// { name: 'a', pin: true, internal: 'i', profile: { city: 'c' } }

schema.filterPrivate(record(), 'read')
// { name: 'a', pin: true, profile: { city: 'c' } }
```

Use the mode to split the two directions. Mark a field `private('read')` when it
must not be sent out but may be written, and `private('write')` for the reverse,
then call `filterPrivate(data, 'read')` on the way out and
`filterPrivate(data, 'write')` on the way in.

`private()` and `privateValue()` apply only when `filterPrivate` is called.
`validate()` and `applyFilters()` do not remove them.

`encrypt()` is a filter marker too, handled separately. See
[Encryption](encryption.md).
