# Server configuration

```ts
new Server({
  port: 3838,
  path: '/api',
  model: {/* ModelManager config */},
})
new Server(config, existingModelManager)
```

| Option   | Default | Meaning                                                                           |
| -------- | ------- | --------------------------------------------------------------------------------- |
| `path`   | `/api`  | Prefix for every route                                                            |
| `port`   | `3838`  | Port for `start()`                                                                |
| `appDir` |         | Resolved to an absolute path and available to your code as `config.appDir`        |
| `model`  |         | [ModelManager](../../om/README.md) config: data sources, repos, services, schemas |

Any other keys are kept on `server.config`, and are available to endpoints as
`{ src: 'container', srcPath: 'config.yourKey' }`. Pass an existing
`ModelManager` as the second argument to share one across servers or tests.

`setLogger(logger)` replaces the console logger. A logger needs `error()`, and
optionally `warn()`, `info()` and `debug()`.
