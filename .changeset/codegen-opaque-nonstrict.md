---
'@datacapy/schema': minor
'@datacapy/codegen': minor
---

Add the `EmptyArray`, `NonStrict` and `Opaque` tags, so free-form arrays and objects can be generated: `Default<t.EmptyArray>`, `strict(false)`, and `as<T>()` without validating the contents.
