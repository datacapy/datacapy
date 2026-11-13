---
'@datacapy/codegen': minor
---

`Opaque` now works on a property nested inside an array of objects (`messages[].user`), not only on a top-level property. The generated `as<...>()` type walks the path with `NonNullable` and `[number]`.
