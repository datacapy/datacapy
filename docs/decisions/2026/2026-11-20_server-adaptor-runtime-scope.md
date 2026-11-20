# Server adaptor: Node only

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- Hono also runs on Bun, Deno and edge runtimes. Veysur needs `http.Server` for socket.io and formidable needs `IncomingMessage`.

## Decision

Support Node only (`http.Server`, `@hono/node-server`). Other runtimes are out of scope.

## Key reasons

- Keeps multipart, socket.io and graceful shutdown simple.

## Rejected alternatives

| Alternative           | Rejected because                                   |
| --------------------- | -------------------------------------------------- |
| Runtime-agnostic seam | Forces Web-standard multipart and no `http.Server` |

## Revisit when

- A consumer needs Bun, Deno or edge.
