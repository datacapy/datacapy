# Server adaptor: release as a major version

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- `@datacapy/server` is 1.1.0, so breaking changes are `major` (`docs/releasing.md`); the below-1.0 rule does not apply.
- Breaking changes: `express` becomes an optional peer, `skipResponse` is removed, `HttpRequest` gains required members, `res.header` sets values verbatim, and `ExpressAdaptor` is not exported from the main entry.

## Decision

Release as a major version (2.0.0) with migration notes ([migrating-to-2.md](../../../package/server/docs/migrating-to-2.md)). No deprecation cycle.

## Key reasons

- The change is visible at install time (`express` must be added), so a minor would break installs without warning.
- A deprecation cycle would keep `express` a hard dependency and delay Hono-only installs.

## Rejected alternatives

| Alternative                    | Rejected because                              |
| ------------------------------ | --------------------------------------------- |
| Minor with a deprecation cycle | Delays optional `express`; carries two shapes |

## Revisit when

- Never; superseded only by a later versioning decision.
