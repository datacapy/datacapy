---
'@datacapy/codegen': minor
---

Generate string-keyed maps and opaque objects. `{ [k: string]: V }` and `Record<string, V>` emit `sb.object().matchAll(V)`, `Record<string, unknown>` and `object` emit `sb.object().as<...>()`, and a marked interface that is only an index signature emits a schema-level `matchAll` with no `shape`.
