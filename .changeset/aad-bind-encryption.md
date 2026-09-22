---
"mzen-om": minor
---

`SchemaEncryptionServiceRsa` now binds encrypted field values to a caller-supplied context via AES-256-GCM's additional authenticated data (AAD) - `mzen-schema` passes the field's path. Previously, a field's encrypted envelope, copied verbatim into a different field or document, would decrypt successfully with no error; it now fails to decrypt unless the same context is supplied. The envelope format is versioned (`v: 2`) so pre-existing values encrypted before this change (no `v`, no AAD ever applied) continue to decrypt correctly - `v` gates whether AAD is applied on decrypt, not the mere presence of a context argument. Also adds the previously-missing dedicated test suite for this file (round-trip, tamper detection, missing-private-key, legacy-plaintext fallback, and the new context-binding behaviour).
