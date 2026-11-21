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

Express middleware such as `helmet()` and `cors()` works through the same
methods, since the handlers are plain `(req, res, next)` functions. For anything
else, `server.adaptor.native` is the framework instance (the Express
application, or the Hono app).

Errors thrown outside an endpoint method, in your own middleware for example,
are caught by a final handler that logs them and returns a 500.
