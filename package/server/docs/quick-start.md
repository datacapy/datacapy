# Quick start

A service with two methods and one role. Tags on the service say which methods
are endpoints, and `datacapy-gen` writes the endpoint config from them.

Express is an optional peer dependency, so install it with the server, plus
`tsx` to run TypeScript directly:

```bash
pnpm add @datacapy/server express
pnpm add -D @datacapy/codegen tsx typescript @types/express @types/node
```

Tell the generator where the services are, in `datacapy.config.json`:

```json
{ "endpoints": { "include": ["src/**/Service*.ts"] } }
```

Save the service as `src/ServiceNote.ts`. `@endpoints` names the service, and
each endpoint method has a `@route` and an `@acl`:

```ts
import { Service, ServerErrorNotFound } from '@datacapy/server'
import type { tagsEndpoint as e } from '@datacapy/server'

/** @endpoints note */
export class ServiceNote extends Service {
  private notes = [{ id: 1, text: 'Hello', owner: 'kevin' }]

  constructor() {
    super({ name: 'note' })
  }

  /**
   * @route get /:id
   * @acl authed
   */
  async get({ id }: { id: number & e.Param }) {
    const note = this.notes.find((n) => n.id === id)
    if (!note) throw new ServerErrorNotFound({ message: 'No such note' })
    return note
  }

  /**
   * @route post /
   * @acl authed
   */
  async add({
    text,
    aclContext,
  }: {
    text: string & e.Body
    aclContext: { user: string } & e.AclContext
  }) {
    const note = { id: this.notes.length + 1, text, owner: aclContext.user }
    this.notes.push(note)
    return note
  }
}
```

Generate the config. It writes `src/ServiceNote.endpoints.ts` beside the
service; commit it and never edit it:

```bash
pnpm datacapy-gen
```

Save the server as `src/server.ts`:

```ts
import Server, { ServerAclRoleAssessor } from '@datacapy/server'

import { ServiceNote } from './ServiceNote'
import { noteConfig } from './ServiceNote.endpoints'

// Demo only: trusts a header. A real role assessor verifies a token or session.
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

server.modelManager.addService(new ServiceNote())
server.addRoleAssessor(new Authed())
server.addApiConfig(noteConfig)

server.init().then(() => server.start())
```

Start it, then call it from a second terminal:

```bash
pnpm tsx src/server.ts
```

```bash
curl -i http://localhost:3838/api/note/1
curl -i -H 'X-User: sam' http://localhost:3838/api/note/1
curl -i -H 'X-User: sam' -H 'Content-Type: application/json' -d '{"text":"hi"}' http://localhost:3838/api/note
```

Expected responses:

```
GET  /api/note/1                 (no X-User)   401 {"name":"ServerErrorUnauthorized"}
GET  /api/note/1                 (X-User: sam) 200 {"id":1,"text":"Hello","owner":"kevin"}
GET  /api/note/99                (X-User: sam) 404 {"message":"No such note","name":"ServerErrorNotFound"}
GET  /api/note/abc               (X-User: sam) 403 {"validationErrors":{"id":["'abc' of type String cannot be cast to type Number"]}}
POST /api/note  {"text":"hi"}    (X-User: sam) 200 {"id":2,"text":"hi","owner":"sam"}
```

To write the config by hand instead of generating it, see
[API configs](api-configs.md). All tags:
[endpoint generator](../../codegen/docs/endpoints.md).

The URL is `server path + service path + endpoint path`: `/api` + `/note` +
`/:id`. The service path defaults to the kebab-case service name (`noteBook`
becomes `/note-book`).
