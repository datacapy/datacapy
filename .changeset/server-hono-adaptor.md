---
'@datacapy/server': minor
---

Add `HonoAdaptor`, a second implementation of the `HttpAdaptor` contract on Hono and `@hono/node-server` (Node only). `hono` and `@hono/node-server` are optional peer dependencies. The conformance suite (`runAdaptorConformance`) now runs against both adaptors. `HttpRequest` gains required `node`, `params` and `query`, and `res.header` sets values exactly as given.
