---
'@datacapy/server': minor
---

Add the framework-neutral `HttpAdaptor` contract (`HttpRequest`, `HttpResponse`, `Handler`, `StreamOptions` and related types) as the seam for running on Express or Hono. `Server` now runs on the new `ExpressAdaptor` (exposed as `server.adaptor`); `server.app`, `server.router` and `server.server` are unchanged. An endpoint that has already written its response no longer reaches the automatic success response.
