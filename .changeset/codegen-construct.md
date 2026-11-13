---
'@datacapy/schema': minor
'@datacapy/codegen': minor
---

Add the `Construct<Name>` tag, which generates `construct('Name')` with the constructor found by name. It carries a constructed relation such as a populated child record, and keeps `nullable()` beside `Default<null>` so the constructor is skipped for a null value.
