<!-- cspell:ignore noteget -->

# @datacapy/server

Part of the [DataCapy monorepo](https://github.com/datacapy/datacapy).

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
- **Pluggable HTTP framework**: Express (default) or Hono through an adaptor.
  See [HTTP adaptors](docs/http-adaptor.md)

@datacapy/server does not authenticate anyone. It gives you the place to do it:
a role assessor reads whatever credential your application uses and decides
which roles the request has. See [Access control](docs/access-control.md).

## Install

```bash
pnpm add @datacapy/server
```

It depends on `@datacapy/om` (models, services, repositories) and, by default,
`express` (an optional peer dependency; see
[HTTP adaptors](docs/http-adaptor.md)). Everything `@datacapy/om` exports,
including `Service`, `Repo`, `ModelManager` and `Schema`, is re-exported from
`@datacapy/server`.

## Quick start

Tag a service with `@endpoints`, `@route` and `@acl`, run `datacapy-gen` to
write the endpoint config, and register it on the server. The walkthrough, with
install, run and `curl` commands, is the [quick start](docs/quick-start.md).

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

## Guides

- [API configs](docs/api-configs.md): Config options and endpoint options
- [Request data](docs/request-data.md): Extract, cast and validate request
  values
- [Responses and errors](docs/responses-and-errors.md): Status codes, content
  types and typed errors
- [Access control](docs/access-control.md): Rules, role assessors and conditions
- [Body parsing](docs/body-parsing.md): JSON and other body parsers
- [Enabling and disabling](docs/enabling-and-disabling.md): Switch configs,
  endpoints and groups off
- [Server configuration](docs/server-configuration.md): `Server` options
- [Lifecycle](docs/lifecycle.md): Start-up and shutdown stages and hooks
- [Middleware and the HTTP framework](docs/middleware.md): Custom middleware and
  the adaptor

## Licence

[BSD 3-Clause](LICENSE)
