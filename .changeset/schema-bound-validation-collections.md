---
'@datacapy/schema': minor
---

Bound the work `validate`, `validatePaths` and `validateQuery` do on untrusted input. Arrays and objects with more than `maxCollectionSize` entries (default 10,000) are rejected with one error and no longer walked, a call visits at most `maxNodes` fields (default 1,000,000), and strict mode reports at most `maxFieldErrors` unspecified fields per object (default 100) plus a summary. Validation also runs in bounded batches instead of creating one pending promise per field, which previously used about 2.4 KB per field and could exhaust memory on a large payload. Set any limit to `Infinity` to restore the old behaviour. Filtering, private-field stripping and transient handling are not limited.
