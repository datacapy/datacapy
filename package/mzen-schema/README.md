# mzen-schema

Data schemas for JavaScript and TypeScript. Define the shape of your data once,
then use the schema to type-cast, filter, validate, hide private fields and
encrypt sensitive fields.

- **Fluent builder** (`sb`) for defining schemas, with an equivalent
  plain-object spec underneath
- **Validation**: required, length, regex, email, allowed values, custom sync or
  async rules, per-rule messages
- **Type-casting**: `'33'` becomes `33`, `'true'` becomes `true`, and values
  that cannot be cast become validation errors
- **Filtering**: defaults, trimming, case, HTML stripping, conditional and
  custom filters
- **Private fields**: strip or mask fields per read or write mode
- **Field encryption**: mark fields for at-rest encryption using your own
  encryption service
- **Composition**: nested objects, arrays, named schema references, `$or`
  alternatives, dynamic keys, class constructors
- **Query validation**: cast and validate the values in a MongoDB-style query

## Install

```bash
npm install mzen-schema
```

## Quick start

```ts
import { Schema, sb } from 'mzen-schema'

const personSchema = new Schema(
  sb
    .schema('person')
    .strict()
    .shape({
      _id: sb.string(),
      name: sb.string().label('Name').required().trim().length(2, 50),
      email: sb.string().email().lowercase(),
      age: sb.number(),
      tel: sb
        .string()
        .regex(/^[+0-9]+$/, { message: 'Tel must contain digits only' })
        .regex(/^\+/, {
          message: 'Tel must start with a country code (e.g. +44)',
        }),
      createdAt: sb.date().default('now'),
      address: sb.object({
        city: sb.string().required(),
        postcode: sb.string().uppercase(),
      }),
    })
    .build()
)

const paul = {
  name: '  Paul ',
  email: 'Paul@Example.COM',
  age: '33',
  tel: '0123456789',
  address: { city: 'Liverpool', postcode: 'l1 8jq' },
}

const { isValid, errors } = await personSchema.validate(paul)

isValid // false
errors // { tel: ['Tel must start with a country code (e.g. +44)'] }
```

`validate()` also **modifies the object in place**: it casts, applies filters
and fills defaults, whether or not the data is valid. After the call above
`paul` is:

```ts
{
  name: 'Paul',
  email: 'paul@example.com',
  age: 33,
  tel: '0123456789',
  address: { city: 'Liverpool', postcode: 'L1 8JQ' },
  _id: 'ecrDWdCQCiXSrf6', // generated: a String field named _id defaults to mzen-id
  createdAt: 2026-09-21T17:32:34.279Z,
}
```

Validate a clone if you need to keep the input untouched.

## Guides

| Guide                              | Covers                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| [Builder](docs/builder.md)         | Every builder and method, `.build()`, the equivalent plain spec, `$` option reference        |
| [Validation](docs/validation.md)   | Rules, error messages, result shape, strict mode, casting, partial-path and query validation |
| [Filtering](docs/filtering.md)     | Defaults, string filters, conditional and custom filters, private fields                     |
| [Encryption](docs/encryption.md)   | Marking fields, the encryption service interface, encrypting and decrypting                  |
| [Composition](docs/composition.md) | Schema references, arrays, `$or`, dynamic keys, constructors, relations                      |

## Plain-object specs

The builder produces a plain object, and `new Schema()` accepts one directly.
Both are supported and interchangeable; the guides use the builder. See
[Builder](docs/builder.md#the-plain-spec-form) for the mapping.

## Related packages

- [`mzen-id`](../mzen-id/README.md) generates the default `_id` values.
- [`mzen-om`](../mzen-om/README.md) uses `mzen-schema` for repository
  validation, private-field filtering and field encryption.

## Licence

[BSD 3-Clause](LICENSE)
