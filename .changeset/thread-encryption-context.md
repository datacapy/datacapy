---
"mzen-schema": minor
---

`SchemaEncryptionService.encrypt()`/`decrypt()` now take an optional `context` argument, and `Schema.applyEncrypt()`/`applyEncryptPaths()`/`applyDecrypt()` pass the field's path as that context. This is the schema-layer half of binding field-encryption ciphertext to where it belongs, closing a gap where an encrypted field's stored value, moved to a different field, would decrypt successfully with no error. The interface change is backward-compatible (the parameter is optional); a `SchemaEncryptionService` implementation that ignores it behaves exactly as before.
