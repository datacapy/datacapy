---
"mzen-om": minor
---

Reject unrecognised query operators in the MySQL query builder instead of silently dropping them. Previously, a query field using an operator outside the registered set (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$type`, `$like`, `$regex`, `$options`, `$and`, `$or`, `$nor`, `$not`) contributed nothing to the WHERE clause with no error - if every field in a query used such an operator, the resulting SQL had no WHERE clause at all, so `SELECT`/`UPDATE`/`DELETE` would run unscoped against the whole table instead of failing. `buildWhereClause` now throws `Invalid query operator: <operator>` for any operator not in the registry.

This is a behaviour change for any caller relying on an unregistered operator being silently ignored - none are known to exist, but it is a minor bump rather than a patch since it can newly throw where it previously didn't.
