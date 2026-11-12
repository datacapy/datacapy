---
'@datacapy/codegen': minor
---

The `@schema` marker accepts `construct=<Name>`, `strict` and `no-strict`, and `datacapy.config.json` gains a `strict` default. The generator emits `sb.schema('x').construct('X').strict().shape({...})`. An unknown marker option fails the run.
