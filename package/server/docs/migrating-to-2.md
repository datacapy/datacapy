# Migrating to @datacapy/server 2

Version 2 runs on a pluggable HTTP adaptor (Express by default, Hono optional).
Most applications need only the first change. Contract details:
[http-adaptor.md](http-adaptor.md).

## Install `express` yourself

`express` is now an optional peer dependency. An application on the default
adaptor adds it:

```bash
pnpm add express
```

A Hono application installs `hono` and `@hono/node-server` instead and sets
`adaptor: 'hono'`.

## `skipResponse` is removed

An endpoint that wrote its own response no longer needs the flag. The server
skips its automatic response once the response is handled (`res.handled` or
headers sent). Stream with `res.stream(readable, options)` rather than
`res.write` and `res.end`: it handles back-pressure and a client that
disconnects.

## Request and response types

- `HttpRequest` has required `node` (the Node request), `params` and `query`.
  Read a raw body from `req.node`.
- `res.header(name, value)` sets the value exactly as given. Express's own alias
  appends a charset to text types.
- `ExpressAdaptor` and `ExpressAppManager` are no longer exported from the main
  entry. Import the adaptor from `@datacapy/server/express` if you need it.

## Middleware and routes

`server.app` and `server.router` still work on Express and throw under Hono.
Prefer the neutral methods, which work on both:

| Express                         | Neutral                                |
| ------------------------------- | -------------------------------------- |
| `server.app.use(fn)`            | `server.use('app', fn)`                |
| `server.router.use('/p', fn)`   | `server.use('router', '/p', fn)`       |
| `server.app.get('/x', fn)`      | `server.route('app', 'get', '/x', fn)` |
| `server.app.set('trust proxy')` | `server.trustProxy([...])`             |
| `express.static(dir)`           | `server.static(...)`                   |

Stage `app` runs before datacapy's router is mounted, stage `router` inside it.
A trailing `/*name` wildcard arrives as one string. Router-stage handlers on
Hono must be registered before the router is mounted.
