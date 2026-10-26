<p align="center">
  <img src="asset/datacapy.png" alt="DataCapy: a capybara resting on curly and square brackets" width="420">
</p>

# DataCapy

**Define your data once. Query any database, validate in the browser and on the server, and serve it over REST.**

```ts
// Find customers and load their orders in one call, with no SQL and no joins
const customers = await customerRepo.find(
  { name: { $in: ['Ada Lovelace', 'Grace Hopper'] } },
  { populate: { orders: true } },
)
// [{ _id: 'ecrDWdCQCiXSrf6', name: 'Ada Lovelace', orders: [{ number: '#1001', total: 42 }, ...] }, ...]
```

The datasource is configuration. Swap `DataSourceMysql` for `DataSourceMongodb` or
Redis and that query does not change, and there is no second client library to learn.

- **One query language** for MySQL, MongoDB and Redis, with relations that can span databases.
- **One schema** that runs in the browser and on the server, so both enforce the same rules.
- **REST from config**: nothing is reachable until you declare it, and every request is validated, cast and access-checked.

Use the pieces together or separately. Migrations and time-ordered IDs are included.

## Quick start

```bash
pnpm add @datacapy/om @datacapy/id mysql2
```

`@datacapy/om` re-exports `@datacapy/schema`. `@datacapy/id` generates the time-ordered
string IDs used for `_id`. `mysql2` is a peer dependency; add `mongodb` instead for MongoDB. Add
`@datacapy/server` for REST endpoints and `@datacapy/migrate` for migrations. To use a
git checkout instead of npm, see [workspace install](docs/workspace-install.md).

This version runs against an in-memory datasource, so it needs no database:

```ts
import { ModelManager, Repo, DataSourceMock, sb, relb } from '@datacapy/om'
import genUniqueId from '@datacapy/id'

class CustomerRepo extends Repo<unknown> {
  constructor() {
    super({
      name: 'customer',
      dataSource: 'db',
      schema: sb
        .schema('customer')
        .shape({ _id: sb.string(), name: sb.string().required().trim() }),
      relations: {
        orders: relb.hasMany('order').key('customerId'),
      },
    })
  }
}

class OrderRepo extends Repo<unknown> {
  constructor() {
    super({ name: 'order', dataSource: 'db' })
  }
}

const adaId = genUniqueId()

const modelManager = new ModelManager()
modelManager.addDataSource(
  'db',
  new DataSourceMock({
    customer: [{ _id: adaId, name: 'Ada Lovelace' }],
    order: [
      { _id: genUniqueId(), number: '#1001', total: 42, customerId: adaId },
      { _id: genUniqueId(), number: '#1002', total: 18, customerId: adaId },
    ],
  }),
)

const customers = new CustomerRepo()
modelManager.addRepo(customers)
modelManager.addRepo(new OrderRepo())
await modelManager.init()

const found = await customers.find({}, { populate: { orders: true } })
// [{ _id: 'ecrDWdCQCiXSrf6', name: 'Ada Lovelace', orders: [{ number: '#1001', ... }, ...] }]
```

## What you get

### ODM framework

Repositories give you one set of methods and one MongoDB-style query language across
MySQL, MongoDB, Redis and an in-memory mock. A project can use several databases side
by side and read and write them all alike. For any other store, implement the
[`DataSource`](package/om/src/data-source/interface.ts) interface and it gets the same API.

Declare how documents relate, then populate them in one call. Has-one, has-many,
belongs-to-one, belongs-to-many, counts, embedded relations and composite keys are
supported. See [Relations](package/om/docs/relations.md).

Also included: field-level encryption at rest with your own encryption service, and
multi-tenant datasources that route each request to a different database at runtime.

### Schema library

A schema is plain TypeScript with no server-only dependencies. Define it once in a
shared package. The server validates writes with it, and the browser runs the same
rules to show errors before anything is sent.

```ts
import { Schema, sb } from '@datacapy/schema'

export const personSchema = new Schema(
  sb.schema('person').shape({
    name: sb.string().required().trim().length(2, 50),
    email: sb.string().email().lowercase(),
    age: sb.number(),
  }),
)

const { isValid, errors } = await personSchema.validate({
  name: '  Paul ',
  age: '33',
})
// isValid: true, and the object is now { name: 'Paul', age: 33, ... }: cast, trimmed, defaulted
```

### REST layer

Describe each endpoint in config. DataCapy validates and casts the request, checks
access rules, calls your service and maps errors to HTTP statuses.

```ts
server.addApiConfig({
  service: 'note',
  acl: { rules: [{ allow: true, role: 'authed' }] },
  endpoints: {
    getOne: {
      path: '/:id',
      method: 'get',
      verbs: ['get'],
      data: { id: { src: 'param', type: Number, required: true } },
    },
  },
})
```

```
GET /api/note/1    (no credentials)  401
GET /api/note/99                     404 {"message":"No such note"}
GET /api/note/abc                    403 {"validationErrors":{"id":["'abc' of type String cannot be cast to type Number"]}}
GET /api/note/1                      200 {"id":1,"text":"Hello"}
```

The full example is in the [`server` quick start](package/server/README.md#quick-start).

## Packages

| Package                                          | What it does                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`@datacapy/om`](package/om/README.md)           | The mapper: repositories, relations and population, encryption, multi-tenant datasources, adaptors |
| [`@datacapy/schema`](package/schema/README.md)   | Define, cast, filter and validate data. Runs in Node and the browser                               |
| [`@datacapy/server`](package/server/README.md)   | Config-driven Express endpoints with request validation and access control                         |
| [`@datacapy/migrate`](package/migrate/README.md) | Database migration runner with versioned patches and dry-run mode                                  |
| [`@datacapy/id`](package/id/README.md)           | Short, time-ordered Base62 IDs (15 characters)                                                     |

### Guides

- **om**: [Architecture](package/om/docs/architecture.md), [Relations](package/om/docs/relations.md), [Composite Keys](package/om/docs/composite-keys.md), [Validation](package/om/docs/validation.md), [Encryption](package/om/docs/encryption.md), [DataSource Context](package/om/docs/dynamic-datasource.md), [MySQL Indexes](package/om/docs/mysql-indexes.md), [Update Operators](package/om/docs/update-operators.md), [Upsert](package/om/docs/upsert.md), [Performance](package/om/docs/performance.md), [Testing](package/om/docs/testing.md), [Debugging](package/om/docs/debugging.md)
- **schema**: [Builder](package/schema/docs/builder.md), [Validation](package/schema/docs/validation.md), [Filtering](package/schema/docs/filtering.md), [Encryption](package/schema/docs/encryption.md), [Composition](package/schema/docs/composition.md)
- **migrate**: [Architecture](package/migrate/docs/architecture/index.md), [Best Practices](package/migrate/docs/best-practices/index.md), [Advanced Usage](package/migrate/docs/advanced-usage/index.md)

## Contributing

See [Developing DataCapy](docs/development.md) for build and test commands.

## License

[BSD 3-Clause](LICENSE)
