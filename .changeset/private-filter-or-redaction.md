---
"mzen-schema": minor
---

`Schema.filterPrivate()` now redacts `private()`/`privateValue()`-flagged fields nested inside `$or`-composed alternatives. Previously, the shared iterator's deliberate refusal to descend into an `$or` field's children (left to validation, which handles `$or` separately) meant a private field behind an `$or` alternative was never visited by the private-filter pass at all, and survived un-redacted. Redaction now walks each `$or` alternative whose type matches the actual value's runtime type via a dedicated, narrowly-scoped pass - the general `$or` skip for type-casting/validation purposes is unchanged. No current veysur schema combines `private()` with `$or`, so this closes a latent defect rather than a live one.
