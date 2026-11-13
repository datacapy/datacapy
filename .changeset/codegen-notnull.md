---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Add the `NotNull` tag, which generates `notNull()`. `required()` alone accepts `null`, so a field that must reject it needs the tag.
