# Server adaptor: one package with adaptor subpath exports

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- `express` is a hard dependency today. Adaptors must track core types closely.

## Decision

Ship `@datacapy/server/express` and `@datacapy/server/hono` as subpath exports in the existing package, with `express` and `hono` as optional peer dependencies.

## Key reasons

- One versioned unit and a simpler release.
- `Server` requires each adaptor on demand, so an unused framework is never loaded.
- `typesVersions` mirrors the `exports` map for tools that use `node10` module resolution.

## Rejected alternatives

| Alternative               | Rejected because                        |
| ------------------------- | --------------------------------------- |
| Separate adaptor packages | Extra release overhead for two adaptors |

## Revisit when

- A third adaptor or a large dependency footprint appears.
