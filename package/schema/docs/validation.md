# Validation

`schema.validate(data)` type-casts, applies filters and defaults, then checks
every rule. It returns `{ isValid, errors }` and modifies `data` in place.

```ts
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'

const schema = new Schema(
  sb.schema().shape({
    name: sb.string().label('Name').required().length(2, 50),
    age: sb.number(),
  })
)

const data = { name: 'K', age: '33' }
const result = await schema.validate(data)

result.isValid // false
result.errors // { name: ['Name must be at least 2 characters long'] }
data.age // 33 (cast from '33')
```

## Rules

| Method                                             | Passes when                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `required()`                                       | The value is neither `undefined` nor `null`                                                                              |
| `notNull()`                                        | The value is not `null`. The string `'null'` is a normal string unless `notNull({ treatNullStringAsNull: true })` is set |
| `notEmpty()`                                       | The value is not empty                                                                                                   |
| `isEmpty()`                                        | The value is empty                                                                                                       |
| `email()`                                          | The string looks like an email address                                                                                   |
| `minLength(n)`, `maxLength(n)`, `length(min, max)` | The string length is within the limit                                                                                    |
| `regex(pattern)`                                   | The string matches                                                                                                       |
| `inArray(values)`                                  | The value is one of `values`                                                                                             |
| `validate(fn)`                                     | Your function returns `true`                                                                                             |

An absent (`undefined`) optional field skips its other rules, so
`sb.string().email()` accepts a missing value. Add `required()` to reject it.

### Regular expressions

Call `regex()` more than once to require several patterns. Each pattern has its
own message.

```ts
const tel = sb
  .string()
  .regex(/^[+0-9]+$/, { message: 'Tel must contain digits only' })
  .regex(/^\+/, { message: 'Tel must start with a country code (e.g. +44)' })
```

### Allowed values

```ts
const role = sb.string().inArray(['admin', 'user'], { message: 'Unknown role' })
```

### Matching another field

The `equality` rule compares a field with another path. The builder has no
method for it, so use a plain spec option or a custom rule (below).

```ts
const schema = new Schema({
  password: String,
  confirm: {
    $type: String,
    $validate: { equality: { path: 'password', root: null } },
  },
})
// confirm mismatch -> errors.confirm: ['confirm does not match']
```

`path` may be dotted (`user.password`). It compares against the raw, unfiltered
sibling value, and a rule with no `path` always fails.

### Custom rules

`validate(fn)` takes a function that receives the value and `{ root, label }`,
where `root` is the whole object being validated. Return `true` when valid, or
an error message string (or an array of strings) when not. The function may be
`async`. Call `validate()` again to add more rules.

```ts
const signup = new Schema(
  sb.schema().shape({
    password: sb.string().minLength(8),
    confirm: sb
      .string()
      .label('Confirmation')
      .validate((value, { root, label }) =>
        value === root.password ? true : `${label} must match the password`
      ),
    username: sb.string().validate(async (value) => {
      const taken = await usernameExists(value)
      return taken ? 'That username is taken' : true
    }),
  })
)
```

Return a message rather than `false`. A returned `false` is recorded as the
error value itself, and the `message` option is not applied to custom rules.

## Error messages

Every rule has a default message that uses the field label. `label()` sets it;
without one the field name is used. Pass `{ message }` to any rule to replace
its message, and `{ name }` to identify the rule.

```ts
sb.string().required({ message: 'Please enter your name' })
```

`errors` is an object keyed by the field's dotted path. Each value is an array
of messages. Array elements use their index.

```ts
const orders = new Schema(
  sb.schema().shape({
    items: sb.array(sb.object({ qty: sb.number().required() })),
  })
)

const result = await orders.validate({ items: [{ qty: 1 }, {}] })
result.errors // { 'items.1.qty': ['qty is required'] }
```

`Schema.mergeValidationResults([a, b])` combines several results into one.

## Type-casting

Each field is cast to its declared type before its rules run, so `'33'` becomes
`33` and `'2026-01-02T03:04:05Z'` becomes a `Date`. Casting failures are
validation errors:

```ts
const data = { n: 'abc' }
await new Schema(sb.schema().shape({ n: sb.number() })).validate(data)
// errors.n: ["'abc' of type String cannot be cast to type Number"]
// data.n is now null
```

A value that cannot be cast is a validation error, never a silent default:

| Type    | Accepted                                                                                   | Rejected                                                                |
| ------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Number  | plain decimal and exponent notation, trimmed (`' 5 '`, `'1e3'`)                            | `''`, whitespace, `'0x10'`, `NaN`, `Infinity` (string or number)        |
| Boolean | `true`/`false`, `1`/`0`, `on`/`off`, `yes`/`no` (trimmed, any case); numbers `1` and `0`   | everything else, including `''` and other numbers                       |
| Date    | parseable strings, real calendar days, the keyword `'now'`, numbers that give a valid date | `''`, `'garbage'`, impossible days such as `'2026-02-30'`, Invalid Date |

To keep a value exactly as supplied, use `noCast()`. It stops casting of that
field and of the values matched by a `matchAll()` spec beneath it, which suits
an object of dynamic keys holding mixed types. Fields you declare individually
inside the object are still cast.

```ts
sb.number().noCast() // '12' stays '12'

sb.object().matchAll(sb.mixed()).noCast() // { k: '1' } stays { k: '1' }
```

## Null and empty values

- A `null` value is accepted for any field unless the field has `notNull()` or
  `required()`.
- An `undefined` object field is filled with `{}`, and an `undefined` array
  field with `[]`.
- An object field set to `null` is kept as `null` only if it is `nullable()`;
  otherwise it is replaced by `{}`.

```ts
sb.object({ city: sb.string() }).nullable()
```

## Strict mode

In strict mode, fields not declared in the schema are errors. `strict()` on the
schema (or on an object field) applies to all fields below it. `strict(false)`
on a child opts back out.

```ts
const schema = new Schema(sb.schema().strict().shape({ name: sb.string() }))

const result = await schema.validate({ name: 'K', extra: 1 })
result.errors // { extra: ['Field not specified'] }
```

## Validating part of an object

`validatePaths()` validates only the fields you give it, using dotted paths.
This suits partial updates such as a MongoDB `$set` payload, where absent fields
must not be reported as missing.

```ts
const schema = new Schema(
  sb.schema().shape({
    name: sb.string().required().maxLength(3),
    age: sb.number(),
  })
)

const update = { name: 'Kevin', age: '4' }
const result = await schema.validatePaths(update)
result.errors // { name: ['name must be no more than 3 characters long'] }
update.age // 4
```

## Validating queries

`validateQuery()` casts the values inside a query object, including operator
values such as `$gt`, `$in` and `$or`, using the types of the fields they refer
to. Unknown fields are allowed even in a strict schema.

```ts
const query = { age: { $gt: '30' }, name: { $in: [1, 2] } }
await schema.validateQuery(query)
// query is { age: { $gt: 30 }, name: { $in: ['1', '2'] } }
```

## Limits on large input

`validate()`, `validatePaths()` and `validateQuery()` bound their work so that
an oversized payload costs one error, not memory. Set the options on the
`Schema` config, or pass them in the per-call config, which wins.

| Option              | Default     | Effect                                                                                                                                        |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxCollectionSize` | `10_000`    | An array with more items, or an object with more keys, gets one error and its contents are not walked.                                        |
| `maxNodes`          | `1_000_000` | Most fields one call visits. Past it the call adds a single `$root` error. This covers nested collections that are each under the size limit. |
| `maxFieldErrors`    | `100`       | Most `Field not specified` errors reported per object in strict mode. Further ones are summarised in one error.                               |

```ts
const schema = new Schema(spec, { maxCollectionSize: 50_000 })
```

Use `Infinity` to turn a limit off. `$in` and other array operands in
`validateQuery()` count against `maxCollectionSize` too.

Only validation is limited. Filtering, `filterPrivate()` and transient handling
still process every item, so a large result is never returned with private
fields left in. Checking the size of an object requires listing its keys, so the
time to reject one grows linearly with its key count, but nothing is retained
per key.
