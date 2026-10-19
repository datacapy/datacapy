---
"@datacapy/om": major
"@datacapy/schema": major
---

Field decryption is now opt-in on reads. `find` and `findOne` return encrypted fields as ciphertext unless the query passes `decrypt: true` or the field is declared `.encrypt({ eager: true })`; `Repo.decrypt(docs)` decrypts documents read without it, and `decrypt: true` propagates to populated relations. Writes skip values that are already encrypted envelopes when the service implements the new optional `isEncrypted()` (`SchemaEncryptionServiceRsa` does), so a document read without decryption can be written back without being encrypted twice. Migrate by adding `decrypt: true` to reads that need plaintext.
