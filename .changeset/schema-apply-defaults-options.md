---
'@datacapy/schema': minor
---

Add `defaultsFor` (a compiled `applyDefaults`) and `init(value)`, a construct-time default that is never part of the spec, and options for `SchemaBuilder.applyDefaults` (`cast`, `skip`, `sparse`, `transform`, `extras`, `overrides`). Literal array and object defaults are now copied for each `applyDefaults` call instead of shared.
