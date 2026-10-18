---
"@datacapy/om": minor
"@datacapy/schema": minor
---

Field encryption key rotation. `SchemaEncryptionServiceRsa` accepts several keys (`keys` and `activeKeyId`), stamps each value with a key id in a `v: 2` envelope and reads old envelopes as key `default`. `rewrap()` moves a value to the active key without producing plaintext (optional on `SchemaEncryptionService`), and `EncryptionReencryptor` re-wraps a whole repo in batches, and a run can be repeated or resumed safely.
