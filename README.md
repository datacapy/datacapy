<p align="center">
  <img src="asset/datacapy.png" alt="DataCapy: a capybara resting on curly and square brackets" width="420">
</p>

# DataCapy

**A TypeScript framework for structured Node.js backends.**

Describe your data, store it in MySQL or MongoDB through one query language, and expose your
services as validated, access-controlled REST endpoints from config. It is plain Express underneath,
so any Express middleware works.

- **Data layer:** repositories with relations that load in one call and can span databases. Swap the
  datasource in config and the queries do not change.
- **API layer:** nothing is reachable until you declare an endpoint. Each request is cast,
  validated and access-checked before your code runs.
- **Shared schemas:** write a constructor once as a class with type tags. DataCapy generates the schema
  that validates in the browser and on the server.
- **Typed documents:** register your constructor classes and repositories return instances of them,
  methods included, instead of plain objects.
- **Also included:** in-memory testing, versioned migrations, field-level encryption and
  multi-tenant datasources.

```bash
pnpm add @datacapy/server @datacapy/schema
pnpm add -D @datacapy/codegen
```

`@datacapy/server` re-exports `@datacapy/om` and its `Schema` exports; `@datacapy/schema` is the
package a browser or shared package installs on its own. Licensed under [BSD 3-Clause](LICENSE).

For a real database, install the driver in your own project. `mysql2` and `mongodb` are peer
dependencies of `@datacapy/om`, so add the one you use:

```bash
pnpm add mysql2
pnpm add mongodb
```

### Start where you are

Every layer is its own package, so you can adopt the whole stack or just the part you need.

- **A data layer only:** [`@datacapy/om`](package/om/README.md) for repositories and queries.
- **REST endpoints:** add [`@datacapy/server`](package/server/README.md) to serve services over
  HTTP.
- **Shared validation only:** [`@datacapy/schema`](package/schema/README.md) runs in the browser and
  on the server.
- **Class-first schemas:** [`@datacapy/codegen`](package/codegen/README.md) generates schemas from
  tagged TypeScript classes (or interfaces), so a constructor is declared once.

## The shape of a DataCapy app

```
  browser                          server
  ───────                          ──────
  @datacapy/schema  ◄── same ──►   @datacapy/schema    define, cast, validate
                      definitions        │
                                         ▼
                                   @datacapy/om        repositories, relations, services
                                         │              MySQL · MongoDB
                                         ▼
                                   @datacapy/server    endpoints from config, ACL, errors
                                         │
                                         ▼
                                   Express             plain Express underneath

  alongside:  @datacapy/migrate (versioned database patches)   @datacapy/id (time-ordered IDs)
              @datacapy/codegen (dev tool: tagged classes → @datacapy/schema modules)
```

## One example, all the layers

A note API, and what it returns. `kevin` is signed in; the first request has no credentials.

```
GET /api/note/n1   (no credentials)   401 {"name":"ServerErrorUnauthorized"}
GET /api/note/n1   (signed in)        200 {"_id":"n1","text":"Hello","owner":"kevin","status":"published"}
GET /api/note/n9   (signed in)        404 {"message":"No such note","name":"ServerErrorNotFound"}
```

Four pieces:

1. **Constructor:** one class. Type tags carry validation and filtering rules.
2. **Schema:** `datacapy-gen` writes the schema file from the class.
3. **Server:** a repo, a service and a role assessor.
4. **Config:** exposes the service as an endpoint.

### 1. The constructor

```ts
// Note.ts
import { SchemaConstructor } from '@datacapy/schema'
import type { tags as t } from '@datacapy/schema'

/** @schema note */
export class Note extends SchemaConstructor<Note> {
  _id?: string
  text!: string & t.Trim & t.MinLength<1> & t.MaxLength<280>
  owner?: string
  status!: ('draft' | 'published') & t.Required & t.Default<'draft'>
}
```

- A literal union becomes the allowed values.
- `t.Default` fills a missing value; `t.Required` keeps the field required too.
- `SchemaConstructor` copies `new Note({ ... })` data onto the instance.
- Setup details: the [codegen guide](package/codegen/docs/guide.md).

### 2. The schema

Run `datacapy-gen`. It writes `Note.schema.ts` beside `Note.ts`. Commit it, never edit it.

```ts
export class SchemaNote extends Schema.from(
  sb
    .schema('note')
    .construct('Note')
    .shape({
      _id: sb.string(),
      text: sb.string().required().minLength(1).maxLength(280).trim(),
      owner: sb.string(),
      status: sb.string().required().default('draft').inArray(['draft', 'published']),
    }),
) {}
```

- A generated type check fails the build if the schema and class disagree.
- Only properties become schema fields; methods, getters, statics and private members are ignored.
- The schema constructs `Note` by name, so neither file imports the other.
- Prefer a hand-written schema? See the [`schema` README](package/schema/README.md).

### 3. The server

A repo, a service for the logic, and a role assessor.

```ts
// server.ts
import Server, {
  DataSourceMock,
  Repo,
  Service,
  ServerAclRoleAssessor,
  ServerErrorNotFound,
} from '@datacapy/server'
import { Note } from './Note'
import { SchemaNote } from './Note.schema'

class RepoNote extends Repo<Note> {
  constructor() {
    super({ name: 'note', dataSource: 'db' })
  }
}

class ServiceNote extends Service {
  constructor() {
    super({ name: 'note' })
  }

  async get({ id }: { id: string }) {
    const note = await this.getRepo<RepoNote>('note').findOne({ _id: id })
    if (!note) throw new ServerErrorNotFound({ message: 'No such note' })
    return note
  }
}

class Authed extends ServerAclRoleAssessor {
  constructor() {
    super('authed')
  }

  async initContext(request, context) {
    // demo only: trusts the X-User header
    context.user = request.get('X-User') ?? null
  }

  async hasRole(context) {
    return !!context.user
  }
}

const server = new Server({ port: 3838, path: '/api' })

server.modelManager.addSchemas([new SchemaNote()])
server.modelManager.addConstructors([Note])
server.modelManager.addDataSource(
  'db',
  new DataSourceMock({
    note: [{ _id: 'n1', text: 'Hello', owner: 'kevin', status: 'published' }],
  }),
)
server.modelManager.addRepo(new RepoNote())
server.modelManager.addService(new ServiceNote())
server.addRoleAssessor(new Authed())
```

The model manager links schema to repo by name, so the `note` repo uses the `note` schema.

### 4. The config

```ts
server.addApiConfig({
  service: 'note', // matches the service name
  acl: { rules: [{ allow: true, role: 'authed' }] },
  endpoints: {
    getOne: {
      path: '/:id',
      method: 'get', // calls ServiceNote.get
      verbs: ['get'],
      data: { id: { src: 'param', type: String, required: true } },
    },
  },
})

await server.init()
await server.start()
```

- `data` validates and casts the request.
- `acl` decides who gets in.
- Typed errors map to response statuses.
- For production, swap `DataSourceMock` for MySQL, MongoDB or another store; service code is unchanged.
- Full setup: [`server` quick start](package/server/README.md#quick-start).

### In the browser

The same schema validates a form on the client before anything is sent:

```ts
const { isValid, errors } = await new SchemaNote().validate({ text: '' })
// isValid: false, errors: { text: ['text must be at least 1 characters long'] }
```

## Highlights

- **Declare it, get it.** Nothing is reachable until you declare an endpoint. Each request is
  validated, cast and access-checked before your code runs, and typed errors map to HTTP statuses.
- **One query language.** Repositories speak the same MongoDB-style query language regardless of which
  database you use (such as MySQL or MongoDB). Swap the datasource in config and the queries do not change.
  Relations (has-one, has-many, belongs-to, counts, embedded, composite keys) load in one call and
  can span datasources, such as a MySQL table joined to a MongoDB collection. See [Relations](package/om/docs/relations.md).
- **One source of truth.** A tagged TypeScript class provides the constructor and the validation /
  filtering rules. The generated schema validates writes on the server and form inputs in the browser; a build-time check fails if the two ever drift apart.
- **Easy to test.** Point a repository at a seeded in-memory datasource and a service runs without
  a database, as in [Try it with no database](#try-it-with-no-database). The mock serves reads; it
  does not keep writes.

Also included: field-level encryption at rest with your own encryption service, and multi-tenant
datasources that route each request to a different database at runtime.

## Try it with no database

```bash
pnpm add @datacapy/om @datacapy/id
```

`@datacapy/om` re-exports `@datacapy/schema`, and `@datacapy/id` generates the `_id` values. Add
`@datacapy/server` for REST endpoints. To use a git checkout instead of npm, see [workspace install](docs/workspace-install.md).

To generate schemas from your classes, add `@datacapy/codegen` as a dev dependency and set `schemaModule` in
`datacapy.config.json` so the generated files import from `@datacapy/om`:

```json
{ "schemaModule": "@datacapy/om", "strict": true }
```

Declare the constructors as classes, one file each. `Customer` has a method, and `orders` is related data:

```ts
// Order.ts
import { SchemaConstructor } from '@datacapy/om'

/** @schema order */
export class Order extends SchemaConstructor<Order> {
  _id?: string
  number!: string
  total!: number
  customerId!: string
}
```

```ts
// Customer.ts
import { SchemaConstructor } from '@datacapy/om'
import type { tags as t } from '@datacapy/om'

import type { Order } from './Order'

/** @schema customer */
export class Customer extends SchemaConstructor<Customer> {
  _id?: string
  name!: string & t.Trim
  orders?: Order[] & t.Relation

  greeting() {
    return `Hello, ${this.name}`
  }
}
```

Run `datacapy-gen` to write `Order.schema.ts` and `Customer.schema.ts` beside them, then run the constructors against an in-memory datasource
seeded with data:

```ts
import { ModelManager, Repo, DataSourceMock, RepoRelationBuilder as relb } from '@datacapy/om'
import genUniqueId from '@datacapy/id'

import { Customer } from './Customer'
import { SchemaCustomer } from './Customer.schema'
import { Order } from './Order'
import { SchemaOrder } from './Order.schema'

class RepoCustomer extends Repo<Customer> {
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

class RepoOrder extends Repo<Order> {
  constructor() {
    super({ name: 'order', dataSource: 'db' })
  }
}

const adaId = genUniqueId()

const modelManager = new ModelManager({
  schemas: [new SchemaCustomer(), new SchemaOrder()],
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

const customers = new RepoCustomer()
modelManager.addRepo(customers)
modelManager.addRepo(new RepoOrder())
await modelManager.init()

const found = await customers.find({}, { populate: { orders: true } })
found[0].greeting() // 'Hello, Ada Lovelace'
found[0].orders?.[0] instanceof Order // true
```

Each constructor is declared once, as a class. The generated schema is checked against the class's data
fields, `orders` is a `Relation`: related data that a query populates, never stored on the customer, and
`Repo<Customer>` makes `find()` return `Customer[]`.

The link between a class and its schema is the name. The generated schema says `construct('Customer')`,
and the model manager's `constructors` hold the class of that name; `init()` hands them to every repo,
which turns each stored document into a `Customer` instance, populated `orders` included. The model
manager also assigns each schema to the repo of the same name, so the repos declare none. See
[Constructors and raw data](package/schema/docs/constructors.md) and
[Composition](package/schema/docs/composition.md#constructors).

## Packages

Use them together or separately.

| Package                                          | Use it when you want to                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`@datacapy/om`](package/om/README.md)           | Store and query data through repositories, with relations, encryption and datasources |
| [`@datacapy/server`](package/server/README.md)   | Expose services as REST endpoints with request validation and access control          |
| [`@datacapy/schema`](package/schema/README.md)   | Define, cast, filter and validate data once, in Node and the browser                  |
| [`@datacapy/migrate`](package/migrate/README.md) | Change a database over time with versioned patches and a dry-run mode                 |
| [`@datacapy/id`](package/id/README.md)           | Generate short, time-ordered Base62 IDs (15 characters)                               |

### Guides

- **om**: [Architecture](package/om/docs/architecture.md), [Relations](package/om/docs/relations.md), [Composite Keys](package/om/docs/composite-keys.md), [Validation](package/om/docs/validation.md), [Encryption](package/om/docs/encryption.md), [DataSource Context](package/om/docs/dynamic-datasource.md), [MySQL Indexes](package/om/docs/mysql-indexes.md), [Update Operators](package/om/docs/update-operators.md), [Upsert](package/om/docs/upsert.md), [Performance](package/om/docs/performance.md), [Testing](package/om/docs/testing.md), [Debugging](package/om/docs/debugging.md)
- **schema**: [Builder](package/schema/docs/builder.md), [Validation](package/schema/docs/validation.md), [Filtering](package/schema/docs/filtering.md), [Encryption](package/schema/docs/encryption.md), [Composition](package/schema/docs/composition.md)
- **migrate**: [Architecture](package/migrate/docs/architecture/index.md), [Best Practices](package/migrate/docs/best-practices/index.md), [Advanced Usage](package/migrate/docs/advanced-usage/index.md)

## Contributing

See [Developing DataCapy](docs/development.md) for build and test commands. See [Releasing](docs/releasing.md) for publishing to npm.

## License

[BSD 3-Clause](LICENSE)
