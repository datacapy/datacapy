<p align="center">
  <img src="asset/datacapy.png" alt="DataCapy: a capybara resting on curly and square brackets" width="420">
</p>

# DataCapy

**A TypeScript framework for structured Node.js backends.**

Describe your data, store it in MySQL, MongoDB or Redis through one query language, and expose your
services as validated, access-controlled REST endpoints from config. It is plain Express underneath,
so any Express middleware works.

- **Data layer:** repositories with relations that load in one call and can span databases. Swap the
  datasource in config and the queries do not change.
- **API layer:** nothing is reachable until you declare an endpoint. Each request is cast,
  validated and access-checked before your code runs.
- **Shared schemas:** write a model once as a class with type tags. DataCapy generates the schema
  that validates in the browser and on the server, and the class keeps its methods.
- **Also included:** in-memory testing, versioned migrations, field-level encryption and
  multi-tenant datasources.

```bash
pnpm add @datacapy/server @datacapy/schema
pnpm add -D @datacapy/codegen
```

`@datacapy/server` re-exports `@datacapy/om` and its `Schema` exports; `@datacapy/schema` is the
package a browser or shared package installs on its own. Add `mysql2` or `mongodb` for a real
database. Licensed under [BSD 3-Clause](LICENSE).

### Start where you are

Every layer is its own package, so you can adopt the whole stack or just the part you need.

- **A data layer only:** [`@datacapy/om`](package/om/README.md) for repositories and queries.
- **REST endpoints:** add [`@datacapy/server`](package/server/README.md) to serve services over
  HTTP.
- **Shared validation only:** [`@datacapy/schema`](package/schema/README.md) runs in the browser and
  on the server.
- **Class-first schemas:** [`@datacapy/codegen`](package/codegen/README.md) generates schemas from
  tagged TypeScript classes (or interfaces), so a model is declared once.

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
              @datacapy/codegen (dev tool: tagged classes → @datacapy/schema modules)
```

## One example, all the layers

A note API, and what it returns. `kevin` is signed in; the first request has no credentials.

```
GET /api/note/n1   (no credentials)   401 {"name":"ServerErrorUnauthorized"}
GET /api/note/n1   (signed in)        200 {"_id":"n1","text":"Hello","owner":"kevin"}
GET /api/note/n9   (signed in)        404 {"message":"No such note","name":"ServerErrorNotFound"}
```

It takes four pieces. First, the model, defined once as a class. Type tags carry the rules, the
class keeps its methods, and `datacapy-gen` writes the schema from it. Both files are plain
TypeScript, so a shared package can import them into the browser and the server alike.

```ts
// shared/Note.ts
import { SchemaConstructorBase } from '@datacapy/schema'
import type { tags as t } from '@datacapy/schema'

/** @schema note */
export class Note extends SchemaConstructorBase<Note> {
  _id?: string
  text!: string & t.Trim & t.MinLength<1> & t.MaxLength<280>
  owner?: string
}
```

`SchemaConstructorBase` copies the data given to `new Note({ ... })` onto the instance; a class that
needs more writes its own constructor instead. Set `useDefineForClassFields` to `false` in the
tsconfig, or the field declarations reset the copied values.

Second, run `datacapy-gen`. It writes `shared/Note.schema.ts`, which you commit and never edit:

```ts
export class SchemaNote extends Schema.from(
  sb
    .schema('note')
    .construct('Note')
    .shape({
      _id: sb.string(),
      text: sb.string().required().minLength(1).maxLength(280).trim(),
      owner: sb.string(),
    }),
) {}

const _checkSchemaNote: AssertSchema<SchemaNote, Pick<Note, '_id' | 'text' | 'owner'>> = true
```

The last line fails the build if the schema and the class ever disagree. Only the data fields
become schema fields: methods, getters, statics and private members are left out. The schema
constructs `Note` by name, so the class and the schema are linked without importing each other.
Prefer to write the schema by hand? The builder works the same way; see the
[`schema` README](package/schema/README.md).

Third, a repository, a service that holds the logic, and a role assessor. DataCapy does not
authenticate anyone: the assessor reads whatever credential your application uses and decides which
roles the request has. This one trusts a header, which is fine for a demo and not for production.

```ts
// server.ts
import Server, {
  DataSourceMock,
  Repo,
  Service,
  ServerAclRoleAssessor,
  ServerErrorNotFound,
} from '@datacapy/server'
import { Note } from './shared/Note'
import { SchemaNote } from './shared/Note.schema'

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
  new DataSourceMock({ note: [{ _id: 'n1', text: 'Hello', owner: 'kevin' }] }),
)
server.modelManager.addRepo(new RepoNote())
server.modelManager.addService(new ServiceNote())
server.addRoleAssessor(new Authed())
```

The model manager links the pieces by name: it gives the `note` schema to the `note` repo, and uses the
registered `Note` class to turn each stored document into a `Note` instance, so the repo declares no
schema.

Fourth, the config that exposes the service:

```ts
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

await server.init()
await server.start()
```

The `data` block validates and casts the request, the `acl` block decides who gets in, and the typed
error picks the status. In production, swap `DataSourceMock` for a MySQL or MongoDB datasource and
the service code does not change. The full server setup is in the
[`server` quick start](package/server/README.md#quick-start).

In the browser, the same schema checks a form before anything is sent:

```ts
const { isValid, errors } = await new SchemaNote().validate({ text: '' })
// isValid: false, errors: { text: ['text must be at least 1 characters long'] }
```

## Why it feels different

- **Declare it, get it.** Nothing is reachable until you declare an endpoint. Each request is
  validated, cast and access-checked before your code runs, and typed errors map to HTTP statuses.
- **One query language.** Repositories speak a MongoDB-style query language over MySQL, MongoDB,
  Redis and an in-memory mock. Swap the datasource in config and the queries do not change.
  Relations (has-one, has-many, belongs-to, counts, embedded, composite keys) load in one call and
  can span databases. See [Relations](package/om/docs/relations.md).
- **One definition.** A tagged class is the model, its methods and its rules. The generated schema
  validates writes on the server and form input in the browser, and a build-time check fails if the
  two drift apart.
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

Add `@datacapy/codegen` as a dev dependency, and set `schemaModule` so the generated files import from
`@datacapy/om`:

```json
{ "schemaModule": "@datacapy/om", "strict": true }
```

Declare the models as classes. `Customer` has a method, and `orders` is related data:

```ts
// models.ts
import { SchemaConstructorBase } from '@datacapy/om'
import type { tags as t } from '@datacapy/om'

/** @schema order */
export class Order extends SchemaConstructorBase<Order> {
  _id?: string
  number!: string
  total!: number
  customerId!: string
}

/** @schema customer */
export class Customer extends SchemaConstructorBase<Customer> {
  _id?: string
  name!: string & t.Trim
  orders?: Order[] & t.Relation

  greeting() {
    return `Hello, ${this.name}`
  }
}
```

Run `datacapy-gen` to write `models.schema.ts`, then run the models against an in-memory datasource
seeded with data:

```ts
import { ModelManager, Repo, DataSourceMock, RepoRelationBuilder as relb } from '@datacapy/om'
import genUniqueId from '@datacapy/id'

import { Customer, Order } from './models'
import { SchemaCustomer, SchemaOrder } from './models.schema'

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

Each model is declared once, as a class. The generated schema is checked against the class's data
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
