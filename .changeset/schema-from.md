---
'@datacapy/schema': major
---

`Schema.from(builderSchema)` returns a base class typed with the schema spec, so a schema is one exported class instead of a spec object plus a class. `Infer` and `sb.defaultsFor()` accept a schema class or instance as well as a spec of builders. The type-level names move from "shape" to "schema spec": `InferShape`, `ShapeInput`, `HasShape` and `_shape` are now `InferSpec`, `SpecInput`, `HasSpec` and `_spec`. The `shape()` method and `shapeOnly` option are unchanged.
