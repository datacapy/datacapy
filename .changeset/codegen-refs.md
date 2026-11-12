---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Generate references to other `@schema` interfaces, inline objects, unions of objects, `Relation`, and `Validate`/`Filter` callbacks from a registry module. Output is formatted with the consumer's Prettier. Add `datacapy-gen --staged` for lint-staged. `@datacapy/schema` gains `sb.refTo<T>()`, a reference with a stated type that works in a schema cycle.
