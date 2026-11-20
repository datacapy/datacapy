# Server adaptor: datacapy path syntax subset

**Status:** accepted
**Decided:** 2026-11-20
**Scope:** package/server

## Context

- Express 5 and Hono differ on wildcards, optional segments and trailing slashes.
- Generated endpoint paths use only `:name`. One consumer route uses a wildcard: `/storage/:bucket/*key`. No consumer uses regex paths.

## Decision

Datacapy defines a small subset: `:name` segments and a trailing `/*name` wildcard. Each adaptor translates it. Regex and optional segments are not supported.

## Key reasons

- The subset covers every current route.
- One syntax means one conformance test per form.

## Rejected alternatives

| Alternative                   | Rejected because                         |
| ----------------------------- | ---------------------------------------- |
| Pass framework syntax through | Routes would silently differ per adaptor |

## Revisit when

- A consumer needs a form outside the subset.
