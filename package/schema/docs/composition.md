# Composition

Build larger schemas from smaller ones: nested objects and arrays, named
references, alternatives, dynamic keys, and class instances.

## Nested objects and arrays

```ts
import { Schema, sb } from '@datacapy/schema'

const order = new Schema(
  sb
    .schema('order')
    .shape({
      customer: sb.object({
        name: sb.string().required(),
        email: sb.string().email(),
      }),
      tags: sb.array(sb.string().trim()),
      lines: sb.array(
        sb.object({
          sku: sb.string().required(),
          qty: sb.number().required(),
        })
      ),
    })
    .build()
)
```

Elements are cast, filtered and validated one by one, and errors carry the
index: `lines.1.qty`.

## Schema references

Give a schema a name, then refer to it from another schema instead of repeating
its fields.

```ts
import { Schema, SchemaManager, sb } from '@datacapy/schema'

const address = new Schema(
  sb
    .schema('address')
    .shape({ street: sb.string().required(), city: sb.string() })
    .build()
)

const person = new Schema(
  sb
    .schema('person')
    .shape({
      name: sb.string().required(),
      home: sb.ref('address'),
      work: sb.object().schema('address').nullable(),
      previous: sb.array().ofSchema('address'),
    })
    .build()
)

const manager = new SchemaManager({ schemas: [address, person] })
await manager.init()

const data = { name: 'K', home: { city: 'L' }, previous: [{ street: 's' }, {}] }
const result = await person.validate(data)
result.errors
// { 'home.street': ['street is required'], 'previous.1.street': ['street is required'] }
```

The three forms are equivalent ways to say "validate this with the `address`
schema":

| Form                             | Use for                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| `sb.ref('address')`              | A field                                                                   |
| `sb.object().schema('address')`  | A field that also needs `nullable()`, `strict()` or another object option |
| `sb.array().ofSchema('address')` | Each element of an array                                                  |

The `SchemaManager` resolves names. Register every schema with it and call
`init()` once before validating. Without it, validation throws
`Missing schema reference address`. A schema needs a name
(`sb.schema('address')`) to be referenced.

## Alternatives with `or`

`sb.or([...])` accepts a value that satisfies any one of several specs. They are
tried in order, and the first that passes is used, including its type-cast.

```ts
const schema = new Schema(
  sb
    .schema()
    .shape({
      value: sb.or([sb.number(), sb.string().email()]),
    })
    .build()
)

// 5        -> valid, stays 5
// '7'      -> valid, cast to 7 (first alternative)
// 'a@b.co' -> valid, stays a string (second alternative)
// 'nope'   -> invalid, one message per alternative
```

A value that already has the right type is not cast, so `'42'` against
`[sb.string(), sb.number()]` stays a string.

## Dynamic keys with `matchAll`

`matchAll(spec)` applies one spec to every key of an object. Use it for maps
such as translations, where the keys are not known in advance.

```ts
const schema = new Schema(
  sb
    .schema()
    .shape({
      title: sb.object().matchAll(sb.string().trim().maxLength(60)),
    })
    .build()
)

const data = { title: { en: ' Hello ', de: 'Hallo' } }
await schema.validate(data)
// data.title is { en: 'Hello', de: 'Hallo' }
```

The spec applies to every property of the object, including any you declare
alongside it, so do not mix declared fields with `matchAll` expecting the
declared ones to be exempt.

## Constructors

A schema can turn plain data into class instances. Register the classes with the
schema and name them with `construct()`. `applyTransients(data)` then builds the
instances.

```ts
class Address {
  street!: string
  city!: string
  constructor(data: Pick<Address, 'street' | 'city'>) {
    Object.assign(this, data)
  }
}

class User {
  first!: string
  last!: string
  address!: Address
  constructor(data: Pick<User, 'first' | 'last' | 'address'>) {
    Object.assign(this, data)
  }
  fullName() {
    return `${this.first} ${this.last}`
  }
}

const userSchema = new Schema(
  sb
    .schema('user')
    .construct(User)
    .shape({
      first: sb.string(),
      last: sb.string(),
      address: sb.object().construct(Address).shape({
        street: sb.string(),
        city: sb.string(),
      }),
    })
    .build(),
  { constructors: [User, Address] }
)

const user = userSchema.applyTransients({
  first: 'A',
  last: 'B',
  address: { street: 's', city: 'c' },
})

user instanceof User // true
user.address instanceof Address // true
user.fullName() // 'A B'
```

A class is matched by its name, or by a static `alias` property if it has one
(use `alias` if minification renames classes). `constructCollection(Class)` does
the same for the array that holds a list of items, and the class needs a static
`fromArray(items)` method.

## Relations

`relation()` marks a field as related data that is loaded from elsewhere and
never stored with this record. Validation skips it, and `stripTransients()`
removes it before persisting.

```ts
const post = new Schema(
  sb
    .schema('post')
    .shape({
      title: sb.string(),
      author: sb.object({ name: sb.string() }).relation(),
    })
    .build()
)

post.stripTransients({ title: 't', author: { name: 'a' } })
// { title: 't' }
```

`@datacapy/om` uses this to populate relations on read and strip them on write.
