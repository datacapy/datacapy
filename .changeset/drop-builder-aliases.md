---
'@datacapy/schema': major
'@datacapy/om': major
'@datacapy/server': major
---

Remove the `sb`, `relb` and `repib` exports (and the default `sb` export). Import `SchemaBuilder`, `RepoRelationBuilder` and `RepoIndexBuilder` and alias them locally, e.g. `import { SchemaBuilder as sb } from '@datacapy/schema'`.
