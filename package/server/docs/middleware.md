# Middleware and the HTTP framework

Register middleware with `server.use(stage, [path], handler)`. Stage `app` runs
before every endpoint, which suits CORS, security headers and request logging;
stage `router` runs inside datacapy's router. The same code runs on Express and
Hono. Choose the framework with `adaptor: 'express' | 'hono'` in the server
config; see [HTTP adaptors](http-adaptor.md).

```ts
server.use('app', (req, res, next) => {
  res.header('X-Frame-Options', 'DENY')
  next()
})
await server.init()
```

On the Express adaptor, `server.app` is the Express application and
`server.router` the router, so existing Express middleware such as `helmet()`
and `cors()` still works there. Both throw under Hono.

Errors thrown outside an endpoint method, in your own middleware for example,
are caught by a final handler that logs them and returns a 500.
