---
"mzen-om": patch
---

Fix `Repo.warnUnknownQueryKeys()` firing a false positive on every query key for a repo with no explicit schema (or one declaring only a `$construct` directive). `initSchema()` falls back to an empty `Schema()` in that case, which has no fields to compare against - previously every key looked "unknown". The warning now only fires when the schema declares at least one real field, matching its intent of catching drift from an actual schema-field removal, not repos that never had a schema to drift from.
