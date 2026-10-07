---
"@datacapy/schema": minor
---

Breaking: an empty array is now a value, not a missing one. The `default` filter only applies to `undefined` and `null`, so an explicit `[]` is kept on a field with a configured default. A missing array field still takes the configured default, or `[]` when none is set.
