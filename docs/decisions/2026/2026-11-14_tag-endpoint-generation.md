# Endpoint configs are generated from tagged service classes

**Status:** accepted
**Decided:** 2026-11-14
**Scope:** package/server, package/codegen

## Context

- Endpoint configs restate the service method: the service name per endpoint, each path param twice (in `path` and in `data`), and `method` beside a key that repeats it.
- Nothing checked that a `:name` in a path had a `data` entry, or the reverse; the parser silently yielded `undefined`.
- Hand-written `default:` keys on 32 entries were never read (the parser reads `defaultValue`) and nothing noticed.
- Schemas were already generated from tagged interfaces, with the generator in lint and pre-commit.

## Decision

Describe each endpoint with JSDoc route tags on the service method and type-only tags on its params object, and generate the checked-in `ServerApiConfig` module with `datacapy-gen`. The generated file ends with `satisfies ServerApiConfig`.

## Key reasons

- The params object is already the exact shape the framework passes, so the tags add only what the signature cannot say.
- The generator can verify what hand-written configs never could: path params against `data`, duplicate routes, route shadowing, and missing `@acl`.
- Same tooling and conventions as schema generation: checked-in output, `--check`, `--staged`.

## Choices inside the decision

- **Namespace `tagsEndpoint`**, not `tags`: `@datacapy/server` already re-exports the schema package's `tags`.
- **`@acl` is required on every `@route`.** Every service starts with a deny-all rule, so access is always stated per route; `public` is role `all`.
- **No `@endpoint` tag.** The endpoint key is the method name. The key only feeds `disable` and `groups`, which nothing in veysur uses; a key that differed from the method name was never needed.
- **Errors:** `@error` covers only classes outside the server's default `ServerError*` map.
- **Emits `defaultValue`,** not the ignored `default`, so migrating an endpoint starts applying its default.
- **Output uses `satisfies`,** not a separate check constant, so a server type change fails in the generated file.

## Rejected alternatives

| Alternative                    | Rejected because                                                               |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Decorators on methods          | Needs `experimentalDecorators` or a runtime registry; tags need neither        |
| A runtime builder (`ep.get()`) | Still hand-written and still restates the signature; no static cross-checks    |
| Class-level error defaults     | The server already maps the `ServerError*` classes; a second layer would drift |

## Revisit when

- `response.success` (custom schema or content type) is needed in a service.
- A service needs one method to answer several routes with different data.
