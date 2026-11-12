---
'@datacapy/codegen': patch
---

Fix generated references: `sb.refTo(() => SchemaX)` returned the class, so validating a schema with a reference failed at run time with `getName is not a function`. The generator now emits `new SchemaX()`.
