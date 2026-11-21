# Lifecycle

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
