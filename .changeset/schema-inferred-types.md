---
'@datacapy/schema': major
---

Infer data types from schemas. `Infer<typeof shape | schema>` derives the object type from builders: `required()` and `default()` make a key non-optional, `nullable()` adds `null`, `inArray()` narrows to a literal union, and arrays, objects, `or()` and references carry their types. `Schema<S>`, `BuilderSchema<S>` and `BuilderObject<T>` are now generic over their shape.

Breaking: schema references are lazy functions, not names. `sb.ref(() => schema)`, `sb.object().schema(() => schema)` and `sb.array().of(() => schema)` replace `sb.ref('name')`, `.schema('name')` and `.ofSchema('name')`, which are removed. The name is read when the schema is first used, so definition order and import cycles no longer matter. `mixed()` now infers `unknown`. `sb.array<T>()` and `sb.object<T>()` no longer take a type argument; the type comes from the argument.
