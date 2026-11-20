# Server adaptor: neutral two-stage middleware registration

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- Consumers register on `server.app` (before the router mounts) and `server.router` (after). Order is load-bearing: storage routes, Stripe webhook and trust-proxy all depend on it.

## Decision

Expose `server.use(stage, path?, handler)` where `stage` is `app` or `router`, and the handler takes the neutral request, response and `next`.

## Key reasons

- Veysur's `init/` code is written once, not per framework.
- The two stages keep the existing ordering guarantee explicit.

## Rejected alternatives

| Alternative                        | Rejected because                     |
| ---------------------------------- | ------------------------------------ |
| Per-adaptor native middleware only | Forks veysur's `init/` per framework |

## Revisit when

- A framework cannot express the two stages.
