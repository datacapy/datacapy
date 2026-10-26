---
'@datacapy/schema': minor
---

`new Schema()` (and so a repo's `schema` option) now accepts a schema builder directly, building it at that point. A trailing `.build()` is no longer needed; `build()` remains for standalone specs.
