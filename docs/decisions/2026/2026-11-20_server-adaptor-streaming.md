# Server adaptor: neutral stream primitive replaces raw res and skipResponse

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- Streaming endpoints (`csvStream`, participant export, invoice PDFs) take the raw Express `Response` via `e.Container<'response'>`.
- `skipResponse` is declared and unit tested but used by no endpoint. After a stream ends, `sendSuccessResponse` still runs on the finished response; on Express 5 that is a silent no-op (pinned by `remote-object/stream-after-return.test.ts`).
- Spike: Hono back-pressure holds (6 MB produced while the client stalled on a 1 GiB response).

## Decision

Add `res.stream(readable, { type, headers, filename })`. The adaptor owns back-pressure, client abort and headers-sent, and marks the response handled so the automatic response is skipped. Remove `skipResponse` in the breaking release.

## Key reasons

- Streaming code stops depending on Express types.
- Makes "already answered" explicit instead of relying on the post-stream write being a no-op.

## Rejected alternatives

| Alternative                       | Rejected because            |
| --------------------------------- | --------------------------- |
| Keep raw `res` as an escape hatch | Keeps Express in 3 services |

## Revisit when

- A response needs trailers or server-sent events.
