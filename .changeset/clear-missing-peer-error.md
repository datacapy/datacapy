---
'@datacapy/server': patch
---

A missing optional peer (`express`, `hono`, `@hono/node-server`) now fails with an install hint instead of Node's bare `Cannot find module`, and the type-test files no longer ship in the tarball.
