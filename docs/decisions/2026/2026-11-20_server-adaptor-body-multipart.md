# Server adaptor: adaptor-owned body parsing and Node-stream multipart

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- `BodyParserConfigurer` wraps `body-parser` (Express middleware). Veysur parses multipart with formidable on the raw `IncomingMessage`. The Stripe webhook needs the raw body on one route.
- Spike: Hono on `@hono/node-server` exposes `c.env.incoming`, and formidable parsed from it.

## Decision

A neutral body config (`json`, `urlencoded`, `text`, `raw`, with per-route override), implemented by each adaptor. Multipart is a neutral option that yields fields and Node-stream files. Node only.

## Key reasons

- Veysur's upload path streams to S3; Node streams keep that unchanged.

## Rejected alternatives

| Alternative        | Rejected because                                            |
| ------------------ | ----------------------------------------------------------- |
| Web `File` objects | Forces buffering or re-adapting the upload path for no gain |

## Revisit when

- A non-Node runtime is supported.
