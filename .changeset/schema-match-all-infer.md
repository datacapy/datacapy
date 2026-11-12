---
'@datacapy/schema': minor
---

`sb.schema().matchAll(spec)` now infers a string-keyed map (`{ [key: string]: V }`) instead of `{}`, so `Infer` and `AssertSchema` work for map schemas such as a localised string.
