---
'@datacapy/om': minor
---

`Repo.transaction()` now re-runs `fn` in a fresh transaction on a MySQL deadlock (errno 1213) or lock wait timeout (1205), up to 3 attempts by default. Pass `{ maxAttempts, backoffMs }` as a third argument to tune it; `maxAttempts: 1` disables retry. `fn` must be safe to re-run.
