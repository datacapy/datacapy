---
'@datacapy/schema': minor
---

Add `SchemaConstructor.from(SchemaX, options?)`, a base class whose instances are typed `Infer<SchemaX>` and filled through the schema's defaults, so a model is `class X extends SchemaConstructor.from(SchemaX) {}` with no interface merge.
