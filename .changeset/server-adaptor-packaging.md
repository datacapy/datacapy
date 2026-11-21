---
'@datacapy/server': major
---

`@datacapy/server` now runs on a pluggable HTTP adaptor: Express (default) or Hono. Breaking changes, with migration steps in `package/server/docs/migrating-to-2.md`:

- `express` is an optional peer dependency, no longer a hard one. Applications on the Express adaptor install it themselves.
- The adaptors are subpath exports, `@datacapy/server/express` and `@datacapy/server/hono`. The main entry no longer exports `ExpressAdaptor` or `ExpressAppManager`.
- `server.app` and `server.router` are removed; use `server.use`, `server.route`, `server.static`, `server.trustProxy`, or `server.adaptor.native`.
- `skipResponse` is removed. An endpoint that has already handled its response is not answered again; use `res.stream` for streams.
- `HttpRequest` has required `node`, `params` and `query`, and `res.header` sets values exactly as given.
