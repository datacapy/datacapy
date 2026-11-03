---
'@datacapy/schema': minor
---

`SchemaConstructor.from` now types its input as raw data: new `InferInputSpec` makes every key optional and nullable, accepts constructed (`as<Class>()`) fields in plain-data form (`Plain`), and accepts `extras` keys, whose instance types come from their extractors (`ExtrasOf`, `ExtrasOutput`). The instance type is unchanged.
