---
'@datacapy/schema': minor
---

`applyDefaults` and `defaultsFor` no longer take `overrides`. Declare a generated value on the schema with `.init(fn)`, or put the value in the field's `default()`.
