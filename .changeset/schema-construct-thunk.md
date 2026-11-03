---
'@datacapy/schema': minor
---

`construct()` and `constructCollection()` accept a thunk (`() => Survey`) to break an import cycle, resolved when first used. `construct()` is also available on `sb.ref()` and `sb.mixed()`. `applyDefaults` and `defaultsFor` wrap each item of an array whose item builder has `construct()`. The `transform` option is removed, which leaves `applyDefaults`, `defaultsFor` and `SchemaConstructor.from` with no options argument and removes the `ApplyDefaultsOptions` type.
