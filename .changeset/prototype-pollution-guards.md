---
"@datacapy/schema": patch
"@datacapy/om": patch
---

Reject `__proto__`, `constructor` and `prototype` as path segments in `ObjectPathAccessor`, `SchemaIterator.mapField` and the Redis data source's nested update paths, closing the prototype-pollution code scanning alerts.
