# Getting started: one example, all the layers

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
4. **Endpoints:** tags on the service expose it, and `datacapy-gen` writes the config.

## 1. The constructor

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
- Setup details: the [codegen guide](../package/codegen/docs/guide.md).

## 2. The schema

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
- Prefer a hand-written schema? See the [`schema` README](../package/schema/README.md).

## 3. The server

A repo, a service for the logic, and a role assessor. The service tags say which methods are
endpoints, with what path, verb and role.

```ts
// server.ts
import Server, {
  DataSourceMock,
  Repo,
  Service,
  ServerAclRoleAssessor,
  ServerErrorNotFound,
} from '@datacapy/server'
import type { tagsEndpoint as e } from '@datacapy/server'
import { Note } from './Note'
import { SchemaNote } from './Note.schema'

class RepoNote extends Repo<Note> {
  constructor() {
    super({ name: 'note', dataSource: 'db' })
  }
}

/** @endpoints note */
class ServiceNote extends Service {
  constructor() {
    super({ name: 'note' })
  }

  /**
   * @route get /:id
   * @acl authed
   */
  async get({ id }: { id: string & e.Param }) {
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

## 4. The endpoints

Add an `endpoints` section to `datacapy.config.json` and run `datacapy-gen` again. It writes
`ServiceNote.endpoints.ts` beside the service. Commit it, never edit it.

```json
{ "endpoints": { "include": ["src/**/Service*.ts"] } }
```

The glob is set once. Any new `Service*.ts` file with an `@endpoints` class is picked up, so a new
service needs no config change.

```ts
// endpoints.ts
export { noteConfig } from './ServiceNote.endpoints'
```

```ts
import * as endpoints from './endpoints'

server.addApiConfigs(Object.values(endpoints))

await server.init()
await server.start()
```

- The endpoint is named after the method (`get`), and `@route` and `@acl` set its path, verbs and role.
- `e.Param` makes `id` a required string read from the URL; the server validates and casts it.
- Typed errors map to response statuses.
- For production, swap `DataSourceMock` for MySQL, MongoDB or another store; service code is unchanged.
- All tags: the [endpoint generator](../package/codegen/docs/endpoints.md). To write the config by hand
  instead, see the [`server` quick start](../package/server/README.md#quick-start).

## In the browser

The same schema validates a form on the client before anything is sent:

```ts
const { isValid, errors } = await new SchemaNote().validate({ text: '' })
// isValid: false, errors: { text: ['text must be at least 1 characters long'] }
```
