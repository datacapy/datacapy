<p align="center">
  <img src="asset/datacapy.png" alt="DataCapy: a capybara resting on curly and square brackets" width="420">
</p>

# DataCapy

**A TypeScript framework for structured Node.js backends.**

A Node.js backend has plenty of parts available: an HTTP layer, data access, validation. Nothing
makes them fit together, so the same validation rules end up written twice, once for the browser
and once for the server.

DataCapy gives the backend a shape. Define your data once, put your logic in services, and expose
them over REST. Schemas describe the data, repositories store it, services hold the logic, and
config turns services into validated, access-controlled endpoints. It is plain Express underneath,
so any Express middleware works. Every layer is its own package, so you can adopt the whole stack
or just the part you need.

### Start where you are

- **Shared validation only:** [`@datacapy/schema`](package/schema/README.md) runs in the browser
  and on the server.
- **A data layer only:** [`@datacapy/om`](package/om/README.md) for repositories and queries.
- **The full stack:** add [`@datacapy/server`](package/server/README.md) to serve services as REST
  endpoints.

## The shape of a DataCapy app

```
  browser                          server
  ───────                          ──────
  @datacapy/schema  ◄── same ──►   @datacapy/schema    define, cast, validate
                      definitions        │
                                         ▼
                                   @datacapy/om        repositories, relations, services
                                         │              MySQL · MongoDB · Redis
                                         ▼
                                   @datacapy/server    endpoints from config, ACL, errors
                                         │
                                         ▼
                                   Express             plain Express underneath

  alongside:  @datacapy/migrate (versioned database patches)   @datacapy/id (time-ordered IDs)
```

## One example, all the layers

A schema defined once. It is plain TypeScript, so a shared package can import it into the browser
and the server alike.

```ts
// shared/noteSchema.ts
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'

export const noteSchema = new Schema(
  sb.schema('note').shape({
    _id: sb.string(),
    text: sb.string().required().trim().length(1, 280),
    owner: sb.string(),
  }),
)
```

A repository that validates every write against it, a service that holds the logic, and the config
that exposes it:

```ts
import Server, { Repo, Service, ServerErrorNotFound } from '@datacapy/server'
import { noteSchema } from './shared/noteSchema'

type Note = { _id: string; text: string; owner: string }

class NoteRepo extends Repo<Note> {
  constructor() {
    super({ name: 'note', dataSource: 'db', schema: noteSchema })
  }
}

class NoteService extends Service {
  constructor() {
    super({ name: 'note' })
  }

  async get({ id }: { id: string }) {
    const note = await this.getRepo<NoteRepo>('note').findOne({ _id: id })
    if (!note) throw new ServerErrorNotFound({ message: 'No such note' })
    return note
  }
}

server.addApiConfig({
  service: 'note',
  acl: { rules: [{ allow: true, role: 'authed' }] },
  endpoints: {
    getOne: {
      path: '/:id',
      method: 'get',
      verbs: ['get'],
      data: { id: { src: 'param', type: String, required: true } },
    },
  },
})
```

```
GET /api/note/n1   (no credentials)   401 {"name":"ServerErrorUnauthorized"}
GET /api/note/n1   (signed in)        200 {"_id":"n1","text":"Hello","owner":"kevin"}
GET /api/note/n9   (signed in)        404 {"message":"No such note","name":"ServerErrorNotFound"}
```

In the browser, the same schema checks a form before anything is sent:

```ts
const { isValid, errors } = await noteSchema.validate({ text: '' })
// isValid: false, errors: { text: ['text must be at least 1 characters long'] }
```

The `data` block validates and casts the request, the `acl` block decides who gets in, and the typed
error picks the status. The full server setup, including a role assessor, is in the
[`server` quick start](package/server/README.md#quick-start).

## Why it feels different

- **Declare it, get it.** Nothing is reachable until you declare an endpoint. Each request is
  validated, cast and access-checked before your code runs, and typed errors map to HTTP statuses.
- **One definition.** A schema validates writes on the server and form input in the browser, with no
  second copy of the rules to keep in step.
- **One query language.** Repositories speak a MongoDB-style query language over MySQL, MongoDB,
  Redis and an in-memory mock. Swap the datasource in config and the queries do not change.
  Relations (has-one, has-many, belongs-to, counts, embedded, composite keys) load in one call and
  can span databases. See [Relations](package/om/docs/relations.md).
- **Easy to test.** Point a repository at a seeded in-memory datasource and a service runs without
  a database, as in [Try it with no database](#try-it-with-no-database). The mock serves reads; it
  does not keep writes.
- **No lock-in.** For a store DataCapy does not cover, implement the
  [`DataSource`](package/om/src/data-source/interface.ts) interface and it gets the same API.

Also included: field-level encryption at rest with your own encryption service, and multi-tenant
datasources that route each request to a different database at runtime.

## Try it with no database

```bash
pnpm add @datacapy/om @datacapy/id
```

`@datacapy/om` re-exports `@datacapy/schema`, and `@datacapy/id` generates the `_id` values. For a
real database add `mysql2` or `mongodb`, and add `@datacapy/server` for REST endpoints. To use a
git checkout instead of npm, see [workspace install](docs/workspace-install.md).

This version runs against an in-memory datasource seeded with data:

```ts
import {
  ModelManager,
  Repo,
  DataSourceMock,
  Schema,
  SchemaBuilder as sb,
  RepoRelationBuilder as relb,
} from '@datacapy/om'
import genUniqueId from '@datacapy/id'

class Order {
  _id!: string
  number!: string
  total!: number
  customerId!: string
  constructor(data: Pick<Order, '_id' | 'number' | 'total' | 'customerId'>) {
    Object.assign(this, data)
  }
}

class Customer {
  _id!: string
  name!: string
  orders?: Order[]
  constructor(data: Pick<Customer, '_id' | 'name'>) {
    Object.assign(this, data)
  }
  greeting() {
    return `Hello, ${this.name}`
  }
}

const customerSchema = new Schema(
  sb
    .schema('customer')
    .construct(Customer)
    .shape({ _id: sb.string(), name: sb.string().required().trim() }),
)

const orderSchema = new Schema(
  sb.schema('order').construct(Order).shape({
    _id: sb.string(),
    number: sb.string(),
    total: sb.number(),
    customerId: sb.string(),
  }),
)

class CustomerRepo extends Repo<Customer> {
  constructor() {
    super({
      name: 'customer',
      dataSource: 'db',
      relations: {
        orders: relb.hasMany('order').key('customerId'),
      },
    })
  }
}

class OrderRepo extends Repo<Order> {
  constructor() {
    super({ name: 'order', dataSource: 'db' })
  }
}

const adaId = genUniqueId()

const modelManager = new ModelManager({
  schemas: [customerSchema, orderSchema],
  constructors: [Customer, Order],
})
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
found[0].greeting() // 'Hello, Ada Lovelace'
found[0].orders?.[0] instanceof Order // true
```

`Repo<Customer>` is the TypeScript type, so `find()` returns `Customer[]`. `construct(Customer)` and the
model manager's `constructors` are the runtime half: `init()` hands the registered classes to every repo,
which turns each stored document into a `Customer` instance, populated `orders` included. The model
manager also assigns each schema to the repo of the same name, so the repos declare none. The two are independent, and using the same class for both is the
convention. See [Composition](package/schema/docs/composition.md#constructors).

## Packages

Use them together or separately.

| Package                                          | Use it when you want to                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`@datacapy/schema`](package/schema/README.md)   | Define, cast, filter and validate data once, in Node and the browser                  |
| [`@datacapy/om`](package/om/README.md)           | Store and query data through repositories, with relations, encryption and datasources |
| [`@datacapy/server`](package/server/README.md)   | Expose services as REST endpoints with request validation and access control          |
| [`@datacapy/migrate`](package/migrate/README.md) | Change a database over time with versioned patches and a dry-run mode                 |
| [`@datacapy/id`](package/id/README.md)           | Generate short, time-ordered Base62 IDs (15 characters)                               |

### Guides

- **om**: [Architecture](package/om/docs/architecture.md), [Relations](package/om/docs/relations.md), [Composite Keys](package/om/docs/composite-keys.md), [Validation](package/om/docs/validation.md), [Encryption](package/om/docs/encryption.md), [DataSource Context](package/om/docs/dynamic-datasource.md), [MySQL Indexes](package/om/docs/mysql-indexes.md), [Update Operators](package/om/docs/update-operators.md), [Upsert](package/om/docs/upsert.md), [Performance](package/om/docs/performance.md), [Testing](package/om/docs/testing.md), [Debugging](package/om/docs/debugging.md)
- **schema**: [Builder](package/schema/docs/builder.md), [Validation](package/schema/docs/validation.md), [Filtering](package/schema/docs/filtering.md), [Encryption](package/schema/docs/encryption.md), [Composition](package/schema/docs/composition.md)
- **migrate**: [Architecture](package/migrate/docs/architecture/index.md), [Best Practices](package/migrate/docs/best-practices/index.md), [Advanced Usage](package/migrate/docs/advanced-usage/index.md)

## Contributing

See [Developing DataCapy](docs/development.md) for build and test commands.

## License

[BSD 3-Clause](LICENSE)
