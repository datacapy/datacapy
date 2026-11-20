# Server adaptor: neutral request and response types as the seam

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- `@datacapy/server` must run on Express and Hono. Handler-time access already goes through `RequestInterface`/`ResponseInterface` (`remote-object/interfaces.ts`).
- The gap is server assembly, middleware, route registration, body parsing and the `http.Server` handle. `Server.app` and `Server.router` are `any`, which let Express leak into 13 consumer files.

## Decision

Define neutral request and response types, extended from the existing interfaces, and implement them per framework in an adaptor.

## Key reasons

- Handlers are written once and run on both frameworks.
- The existing interfaces mean request-time code barely changes.

## Rejected alternatives

| Alternative                   | Rejected because                                 |
| ----------------------------- | ------------------------------------------------ |
| Emulate Express `res` on Hono | Hides Hono behind Express quirks, slower and odd |
| Lowest common denominator     | Discards framework features without need         |

## Revisit when

- A third adaptor needs members neither Express nor Hono has.
