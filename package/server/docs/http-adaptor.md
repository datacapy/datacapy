<!-- cspell:ignore autocannon -->
<!-- cspell:ignore EADDRINUSE -->

# HTTP adaptor contract

`HttpAdaptor` (`src/adaptor/types.ts`) is the seam between datacapy and an HTTP
framework. Code above it uses the neutral `HttpRequest`, `HttpResponse` and
`Handler` types only. Express is the only implementation so far; Hono follows.
Decisions: `docs/decisions/2026/2026-11-20_server-adaptor-*.md`.

## Contract

| Member                                    | Purpose                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `use(stage, [path], handler)`             | Middleware. Stage `app` runs before the datacapy router, `router` inside it. Registration order is run order. |
| `route(stage, method, path, ...handlers)` | A route. Path syntax: `:name` segments and a trailing `/*name`; no regex or optional segments.                |
| `mountRouter(prefix)`                     | Mounts the router stage once, after endpoints are registered.                                                 |
| `bodyParsers(config)`                     | Handlers for one endpoint's normalised `ServerBodyParserConfig`.                                              |
| `static`, `trustProxy`                    | Static files; the proxies whose `X-Forwarded-For` is believed.                                                |
| `native`, `server`                        | The framework instance, and the Node `http.Server` (socket.io attaches here).                                 |
| `listen`, `close`                         | Lifecycle; `close` destroys open connections.                                                                 |

`HttpResponse` adds `header`, `append` (for `Set-Cookie`),
`stream(readable, options)` and `handled`. `isResponseHandled(res)` is true
after any write (headers sent or `handled`), and the automatic success response
is skipped then.

## Express adaptor

`ExpressAdaptor` (`src/adaptor/express`) is the only implementation. `Server`
builds one and exposes it as `server.adaptor`, with `server.server` the Node
server. The Express application is `server.adaptor.native`. Endpoint routes are
registered through `adaptor.route('router', ...)` with
`adaptor.bodyParsers(...)`. The adaptor adds `req.node`, `res.handled` and
`res.stream` to every request, and a client that disconnects mid-stream resolves
quietly while a failing source stream rejects.

## Hono adaptor

`HonoAdaptor` (`src/adaptor/hono`, import `@datacapy/server/hono`) runs the same
contract on Hono with `@hono/node-server`; Node only. It passes the same
conformance suite as Express.

## Installing and choosing an adaptor

`express`, `hono` and `@hono/node-server` are optional peer dependencies.
Install the ones you use:

```bash
# Express (the default)
pnpm add @datacapy/server express

# Hono
pnpm add @datacapy/server hono @hono/node-server
```

Set `adaptor: 'express' | 'hono'` in the `Server` config. `Server` loads the
chosen adaptor on demand, so a Hono-only install never loads `express`. The
adaptors are also importable directly: `@datacapy/server/express` and
`@datacapy/server/hono`. The main entry exports the contract types only.

How it differs inside:

- Handlers are written Express-style (`res.json(...)`, `next()`), so the adaptor
  wraps each one as a Hono middleware. It waits until the handler answers, calls
  `next`, or fails, so callback-style handlers work. One request object and one
  response object live for the whole request, which is why a header set by an
  early handler reaches a later one's response, and a 404 that Hono makes
  itself.
- Router-stage handlers must be registered before `mountRouter`: Hono copies the
  router's routes when it is mounted. A later `use('router', ...)` throws.
- A trailing `/*name` becomes a Hono regex param. Hono's own `strict: false`
  makes a trailing slash match.
- `req.ip` uses `proxy-addr`, the library Express uses, so both adaptors give
  the same answers for the same `trustProxy` list.
- Body parsers are the adaptor's own (`json`, `urlencoded` with `qs`, `text`,
  `raw`), with body-parser's limit, 400, 413 and 415 behaviour. Raw `req.node`
  reading still works for routes that do not use them.
- `res.stream` bridges the Node stream to a Web stream (`Readable.toWeb`), so
  back-pressure and client abort work. `@hono/node-server` logs a failing source
  stream with `console.error` itself.
- Static files are served by the adaptor's own handler (ETag, Last-Modified,
  `max-age`, index file, HEAD, 304); there is no range support.

Rough speed on one machine, one run each (autocannon, 50 connections): small
JSON GET Hono about 30% faster; JSON POST about 20% slower; a 2 MB streamed
response about 35% slower. Treat these as indicative only.

## Conformance

`runAdaptorConformance(label, create)` (`src/test-utils/adaptor-conformance.ts`)
runs real HTTP against any adaptor; a new adaptor passes it before it ships. It
also defines behaviour the types cannot:

- A trailing `/*name` wildcard is one string, the rest of the path (`a/b.txt`),
  not an array.
- A trailing slash on a request still matches the route.
- `listen` resolves once the server is listening, and rejects on `EADDRINUSE`.
- `req.ip` is the socket address unless the peer is trusted; for a trusted peer
  it is the first untrusted hop from the right of `X-Forwarded-For`, so a
  spoofed leftmost entry is ignored.
- A body over its limit answers 413, per route.
- `stream` stops reading the source while the client is not reading, destroys it
  when the client aborts, and rejects when the source fails.
- `close` destroys open connections and refuses new ones.

Multipart is not covered yet; it arrives with the neutral multipart option.

## Status

Phases 1 and 2 of the adaptor plan: the contract and the Express adaptor.
Selecting another adaptor, and the conformance suite, come next.

Upgrading from 1.x: [migrating-to-2.md](migrating-to-2.md).
