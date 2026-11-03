---
'@datacapy/schema': minor
---

`applyDefaults` and `defaultsFor` no longer take `sparse` or `extras`. A key that is absent from the input stays absent, and populated related data is declared as a schema field with `.relation()`.
