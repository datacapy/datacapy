# Server adaptor: typed native escape hatch

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- `Server.app` and `Server.router` are `any`, so consumers reached Express freely.

## Decision

`Server<TApp = unknown>` with `server.adaptor.native` typed per adaptor. Remove `any` from `app` and `router`.

## Key reasons

- Native access remains possible but is visible and typed.

## Rejected alternatives

| Alternative | Rejected because                       |
| ----------- | -------------------------------------- |
| Keep `any`  | It is how Express leaked into 13 files |

## Revisit when

- Native access is needed in more than a few places.
