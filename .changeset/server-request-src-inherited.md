---
"@datacapy/server": patch
---

Read `src: 'request'` values such as the Express `ip` getter through plain property access, since `ObjectPathAccessor` now only traverses own properties.
