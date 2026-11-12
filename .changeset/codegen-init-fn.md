---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Add the `InitFn<Name>` and `DefaultFn<Name>` tags. The generator emits `init(initialisers.Name)` and `default(initialisers.Name)`, importing `initialisers` from the configured `registry` module beside `validators` and `filters`.
