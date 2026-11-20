<!-- cspell:ignore linklocal uniquelocal -->

# Server adaptor: neutral client IP with trustProxy

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- Express derives `req.ip` from `trust proxy`. Hono gives only `socket.remoteAddress` and a raw `X-Forwarded-For`.
- Rate limiting and country blocking depend on a correct client IP, so a spoofable one is a security defect.

## Decision

A neutral `trustProxy` config (loopback, linklocal, uniquelocal presets or a CIDR list) and one `req.ip` computed by each adaptor. The Hono adaptor walks `X-Forwarded-For` from the right through trusted hops.

## Key reasons

- Both adaptors give identical results, proven by the same tests.

## Rejected alternatives

| Alternative                     | Rejected because            |
| ------------------------------- | --------------------------- |
| Trust `X-Forwarded-For` on Hono | Lets clients spoof their IP |

## Revisit when

- Another proxy header (`Forwarded`) must be supported.
