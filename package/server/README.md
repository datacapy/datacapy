<!-- cspell:ignore noteget -->

# @datacapy/server

An HTTP API layer for [Datacapy](../../README.md) applications. You describe
each endpoint in a plain config object; @datacapy/server maps it to an
[Express](https://expressjs.com) route, validates and casts the request data,
checks access rules, calls a method on one of your services or repositories, and
turns the result or the error into an HTTP response.

- **Config-driven endpoints**: path, verbs, target method, request data,
  response codes and access rules live in one object per service or repository
- **Explicit exposure**: nothing is reachable until you declare an endpoint for
  it
- **Request validation and type-casting** using
  [@datacapy/schema](../schema/README.md)
- **Access control** with ordered allow and deny rules and pluggable role
  assessors that decide, per request, whether a caller holds a role
- **Error mapping**: throw a typed error in your service and get the right HTTP
  status
- **Lifecycle hooks** for start-up and shutdown work
- **Plain Express underneath**: use any Express middleware

@datacapy/server does not authenticate anyone. It gives you the place to do it:
a role assessor reads whatever credential your application uses and decides
which roles the request has. See [Access control](#access-control).

## Install

```bash
pnpm add @datacapy/server
```

It depends on `@datacapy/om` (models, services, repositories) and `express`.
Everything `@datacapy/om` exports, including `Service`, `Repo`, `ModelManager`
and `Schema`, is re-exported from `@datacapy/server`.

## Quick start

A service with two methods, one role, and the endpoints that expose them.

```ts
import Server, {
  Service,
  ServerAclRoleAssessor,
  ServerErrorNotFound,
} from '@datacapy/server'

class NoteService extends Service {
  private notes = [{ id: 1, text: 'Hello', owner: 'kevin' }]

  constructor() {
    super({ name: 'note' })
  }

  // Every endpoint method receives one argument: an object holding the
  // request data you declared for the endpoint, plus aclContext and
  // aclConditions.
  async get({ id }: { id: number }) {
    const note = this.notes.find((n) => n.id === id)
    if (!note) throw new ServerErrorNotFound({ message: 'No such note' })
    return note
  }

  async add({
    text,
    aclContext,
  }: {
    text: string
    aclContext: { user: string }
  }) {
    const note = { id: this.notes.length + 1, text, owner: aclContext.user }
    this.notes.push(note)
    return note
  }
}

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

server.modelManager.addService(new NoteService())
server.addRoleAssessor(new Authed())

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
    add: {
      path: '/',
      method: 'add',
      verbs: ['post'],
      data: {
        text: { src: 'body', type: String, required: true, notEmpty: true },
      },
      response: { success: { http: { code: 201 } } },
    },
  },
})

await server.init()
await server.start()
```

```
GET  /api/note/1                 (no X-User)   401 {"name":"ServerErrorUnauthorized"}
GET  /api/note/1                 (X-User: sam) 200 {"id":1,"text":"Hello","owner":"kevin"}
GET  /api/note/99                (X-User: sam) 404 {"message":"No such note","name":"ServerErrorNotFound"}
GET  /api/note/abc               (X-User: sam) 403 {"validationErrors":{"id":["'abc' of type String cannot be cast to type Number"]}}
POST /api/note  {"text":""}      (X-User: sam) 403 {"validationErrors":{"text":["text cannot be empty"]}}
POST /api/note  {"text":"hi"}    (X-User: sam) 201 {"id":2,"text":"hi","owner":"sam"}
```

The URL is `server path + service path + endpoint path`: `/api` + `/note` +
`/:id`. The service path defaults to the kebab-case service name (`noteBook`
becomes `/note-book`).

## How it fits together

| Piece         | Role                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `Server`      | Owns the Express app, the `ModelManager`, the ACL role assessors and the lifecycle     |
| Remote object | The thing an endpoint calls: a `Service` (usual), a `Repo`, or any object with methods |
| API config    | One object per remote object: its path, default ACL rules and its `endpoints`          |
| Endpoint      | One method on the remote object, mapped to a path and one or more HTTP verbs           |
| Role assessor | Decides whether a request has a named role, used by ACL rules                          |

**Only declared endpoints exist.** Adding a repository to the model does not
expose it. Put business logic in a service, and expose the service methods you
want.

## API configs

```ts
server.addApiConfig(config)
server.addApiConfigs([configA, configB])
```

| Option                        | Meaning                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `service` / `repo` / `object` | The remote object: a service name, a repository name (both looked up in the `ModelManager`), or an object instance  |
| `path`                        | Root path for this config. Defaults to `/` plus the kebab-case service or repo name. `''` mounts at the server root |
| `acl.rules`                   | Rules applied to every endpoint in this config                                                                      |
| `endpoints`                   | Map of endpoint name to endpoint config                                                                             |
| `enable`                      | `false` skips the whole config                                                                                      |
| `disable`                     | `{ endpointName: true }` removes named endpoints                                                                    |
| `disableGroup`                | `{ groupName: true }` removes endpoints listing that group in `groups`                                              |

### Endpoints

| Option                        | Meaning                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `method`                      | Name of the method to call on the remote object. The server throws at request time if it does not exist                       |
| `path`                        | Path under the config's root. **Start it with `/`**: a missing slash is concatenated as-is (`/note` + `get` gives `/noteget`) |
| `verbs`                       | HTTP verbs, for example `['get']` or `['get', 'head']`. Default `['get']`                                                     |
| `data`                        | Request data to extract and validate. See [Request data](#request-data)                                                       |
| `acl.rules`                   | Rules added after the config's rules. See [Access control](#access-control)                                                   |
| `response`                    | Success status and content type, and error mapping. See [Responses and errors](#responses-and-errors)                         |
| `service` / `repo` / `object` | Override the remote object for this endpoint only                                                                             |
| `groups`                      | Labels for `disableGroup`                                                                                                     |
| `enable`                      | `false` removes this endpoint                                                                                                 |
| `priority`                    | Higher priority routes register first. Default `0`                                                                            |
| `skipResponse`                | The method sends the response itself. See [Sending your own response](#sending-your-own-response)                             |
| `bodyParser`                  | Per-endpoint body parsing. See [Body parsing](#body-parsing)                                                                  |

**Route order matters.** Express matches in registration order, so a fixed path
must come before a parameter that would swallow it. Give `/stats` a higher
`priority` than `/:id`.

## Request data

`data` maps each argument name to where it comes from and how to check it. The
values arrive on the single object passed to your method.

```ts
data: {
  id: { src: 'param', type: Number, required: true },
  page: { src: 'query', type: Number, defaultValue: 1 },
  token: { src: 'header', srcPath: 'X-Token' },
  city: { src: 'body', srcPath: 'address.city' },
}
```

| Option                            | Meaning                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src`                             | `query` (default), `param`, `body`, `header`, `aclContext`, `aclConditions`, or `container`    |
| `srcPath`                         | Name or dotted path to read. Defaults to the argument name. For `header` it is the header name |
| `type`                            | Type to cast to (`String`, `Number`, `Boolean`, `Date`, ...)                                   |
| `required`, `notNull`, `notEmpty` | Validation rules                                                                               |
| `defaultValue`                    | Used when the value is absent                                                                  |

`container` reads from the whole request context (`request`, `response`,
`config`, `param`, `query`, `body` and the ACL values), so
`{ src: 'container', srcPath: 'response' }` gives your method the Express
response object.

Validation uses [@datacapy/schema](../schema/README.md). A failure returns
**403** with `{ "validationErrors": { field: [messages] } }`. This check runs
before the access rules, so an unauthorised caller who sends invalid data sees
the validation error, not a 401.

## Responses and errors

A method's return value is sent as JSON with status 200. Override that per
endpoint:

```ts
response: { success: { http: { code: 201 } } }
response: { success: { http: { code: 200, contentType: 'text/csv' } } }
```

Any `contentType` other than `json` sets the `Content-Type` header and sends the
value as-is.

Throw one of the built-in errors to choose the status. Extra properties you pass
are included in the response body.

| Error                         | Status |
| ----------------------------- | ------ |
| `ServerErrorBadRequest`       | 400    |
| `ServerErrorUnauthorized`     | 401    |
| `ServerErrorForbidden`        | 403    |
| `ServerErrorNotFound`         | 404    |
| `ServerErrorMethodNotAllowed` | 405    |
| `ServerErrorTooManyRequests`  | 429    |
| `ServerErrorInternal`         | 500    |

```ts
throw new ServerErrorForbidden({ message: 'Not your note', reason: 'owner' })
// 403 {"message":"Not your note","reason":"owner","name":"ServerErrorForbidden"}
```

To map your own error classes, list them by class name in the endpoint's
`response.error`. The first matching entry wins. A `schema` narrows the match to
errors whose properties validate.

```ts
class OutOfStockError extends ServerError {}

response: {
  error: {
    OutOfStockError: { http: { code: 409 } },
  },
}
```

The response body is the error serialised as JSON, so only its own enumerable
properties appear. `ServerError` subclasses include `message`
(`new OutOfStockError('none left')` sends
`{"message":"none left","name":"ServerError"}`). A plain `Error` subclass sends
only the properties you assign to it, and no message.

An error with no matching entry becomes a 500 with
`{ error: "InternalServerError", message, endpoint, method }`.

To rewrite errors globally, for example to translate messages into the caller's
language, set a translator. It runs on every thrown error before matching and
can be async.

```ts
server.setErrorTranslator(async (err, req) => translate(err, req.aclContext))
```

### Sending your own response

For downloads, streams or anything that is not a return value, set
`skipResponse: true` and take the response object as request data.

```ts
files: {
  path: '/:name',
  method: 'download',
  skipResponse: true,
  data: {
    name: { src: 'param' },
    res: { src: 'container', srcPath: 'response' },
  },
}
```

## Access control

An endpoint is denied unless a rule allows it. Each rule names a role and says
whether that role is `allow: true` or `allow: false`.

```ts
acl: {
  rules: [
    { allow: true, role: 'authed' },
    { allow: false, role: 'suspended' },
  ],
}
```

**How rules combine.** The config's rules are followed by the endpoint's rules,
and they are evaluated in order. A rule only counts if the caller holds its
role. When it does, it sets the outcome to its `allow` value, so **later rules
override earlier ones**. The built-in `all` role is held by every request.

```ts
// Anyone authed may call, unless they are suspended, but admins always may
rules: [
  { allow: true, role: 'authed' },
  { allow: false, role: 'suspended' },
  { allow: true, role: 'admin' },
]
```

A denied request throws `ServerErrorUnauthorized` (401).

### Role assessors

A role is defined by a class extending `ServerAclRoleAssessor`. Register it with
`server.addRoleAssessor()` or `addRoleAssessors([...])`.

| Member                                        | Purpose                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `super(name)`                                 | The role name used in rules                                                                                 |
| `priority`                                    | Assessors with a higher priority run `initContext` first. Same-priority assessors run together. Default `0` |
| `initContext(request, context, remoteObject)` | Runs once per request before any rule. Read the credential and store what `hasRole` needs on `context`      |
| `hasRole(context)`                            | Return `true`, `false`, or an object of conditions                                                          |
| `this.repos`                                  | The model's repositories, for lookups                                                                       |

```ts
class ProjectAdmin extends ServerAclRoleAssessor {
  constructor() {
    super('projectAdmin')
  }

  async hasRole({ jwt, projectId }) {
    const ids: string[] = jwt?.adminOf ?? []
    return ids.includes(projectId)
  }
}
```

An assessor that reads context filled in by another (a decoded token, say) needs
a lower `priority` than the assessor that fills it in. Give the
credential-reading assessor the higher number.

### Conditions

`hasRole` may return an object instead of `true`. The request is allowed, and
the object is passed to your method as `aclConditions`, so the method can limit
what it returns, for example to one team's rows.

```ts
async hasRole({ jwt }) {
  return jwt?.teamId ? { teamId: jwt.teamId } : false
}
```

A role that returns conditions is always treated as a grant, whatever its rule's
`allow` says. Once one has granted access, later deny rules do not revoke it.
Use conditions only for roles you allow, and put them last.

### Security notes

- `context` starts as a copy of the request data you declared, so a caller
  controls those keys. Always overwrite the keys your assessor uses in
  `initContext`, and never declare request data whose name matches an ACL
  context key.
- Scope by role, not by a check inside the method. For an endpoint that acts on
  one project, use a role that checks the caller's rights on the `projectId`
  argument, rather than a generic role plus a lookup.

## Body parsing

JSON bodies are parsed by default, limited to `100kb`. Enable other parsers or
change the limit per endpoint:

```ts
bodyParser: {
  json: { limit: '2mb' },
  urlencoded: { enable: true },
  text: { enable: true, type: 'text/csv' },
}
```

## Enabling and disabling

```ts
{ service: 'note', enable: false, endpoints: { ... } }        // whole config
{ service: 'note', disable: { getOne: true }, endpoints: { ... } }  // by name
{ service: 'note', disableGroup: { write: true }, endpoints: {
  add: { groups: ['write'], ... },
} }                                                              // by group
{ getOne: { enable: false, ... } }                                // one endpoint
```

Use this to switch endpoints off per environment without editing the config.

## Server configuration

```ts
new Server({
  port: 3838,
  path: '/api',
  model: {/* ModelManager config */},
})
new Server(config, existingModelManager)
```

| Option   | Default | Meaning                                                                        |
| -------- | ------- | ------------------------------------------------------------------------------ |
| `path`   | `/api`  | Prefix for every route                                                         |
| `port`   | `3838`  | Port for `start()`                                                             |
| `appDir` |         | Resolved to an absolute path and available to your code as `config.appDir`     |
| `model`  |         | [ModelManager](../om/README.md) config: data sources, repos, services, schemas |

Any other keys are kept on `server.config`, and are available to endpoints as
`{ src: 'container', srcPath: 'config.yourKey' }`. Pass an existing
`ModelManager` as the second argument to share one across servers or tests.

`setLogger(logger)` replaces the console logger. A logger needs `error()`, and
optionally `warn()`, `info()` and `debug()`.

## Lifecycle

`await server.init()` runs the stages below in order, then
`await server.start()` listens. Add work to a stage with
`addInitialiser(fn, stage)`. The function receives the server. If it returns a
function, that function runs at shutdown.

| Stage                     | When                                       |
| ------------------------- | ------------------------------------------ |
| (none) and `00-init`      | Before the model starts                    |
| `01-model-initialised`    | After `ModelManager.init()`                |
| `02-resources-loaded`     | Before endpoints are registered            |
| `03-endpoints-registered` | Routes exist, router not yet mounted       |
| `04-router-mounted`       | Router mounted under `path`                |
| `99-final`                | Last, after the error handler is installed |

```ts
server.addInitialiser(async (s) => {
  const queue = await connectQueue()
  return () => queue.close() // runs on shutdown
}, '01-model-initialised')
```

`start()` also listens for `SIGINT` and `SIGTERM`. On either, or on
`await server.shutdown()`, shutdown handlers run in reverse stage order, then
the model shuts down and the HTTP server closes. Add handlers directly with
`addShutdownHandler(fn, stage)`.

## Express

`server.app` is the Express application and `server.router` the router your
endpoints are registered on. Middleware added to `server.app` before `init()`
runs before every endpoint, which suits CORS, security headers and request
logging.

```ts
server.app.use(helmet())
server.app.use(cors({ origin: 'https://app.example.com' }))
await server.init()
```

Errors thrown outside an endpoint method, in your own middleware for example,
are caught by a final handler that logs them and returns a 500.

## Licence

[BSD 3-Clause](LICENSE)
