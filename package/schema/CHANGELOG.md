# @datacapy/schema

## 1.1.0

### Minor Changes

- dd068d4: `new Schema()` (and so a repo's `schema` option) now accepts a schema
  builder directly, building it at that point. A trailing `.build()` is no
  longer needed; `build()` remains for standalone specs.

## 1.0.0

### Major Changes

- 7966276: Field decryption is now opt-in on reads. `find` and `findOne` return
  encrypted fields as ciphertext unless the query passes `decrypt: true` or the
  field is declared `.encrypt({ eager: true })`; `Repo.decrypt(docs)` decrypts
  documents read without it, and `decrypt: true` propagates to populated
  relations. Writes skip values that are already encrypted envelopes when the
  service implements the new optional `isEncrypted()`
  (`SchemaEncryptionServiceRsa` does), so a document read without decryption can
  be written back without being encrypted twice. Migrate by adding
  `decrypt: true` to reads that need plaintext.

### Minor Changes

- 3633ccc: Field encryption key rotation. `SchemaEncryptionServiceRsa` accepts
  several keys (`keys` and `activeKeyId`), stamps each value with a key id in a
  `v: 2` envelope and reads old envelopes as key `default`. `rewrap()` moves a
  value to the active key without producing plaintext (optional on
  `SchemaEncryptionService`), and `EncryptionReencryptor` re-wraps a whole repo
  in batches, and a run can be repeated or resumed safely.

## 0.2.0

### Minor Changes

- a3415b9: Breaking: an empty array is now a value, not a missing one. The
  `default` filter only applies to `undefined` and `null`, so an explicit `[]`
  is kept on a field with a configured default. A missing array field still
  takes the configured default, or `[]` when none is set.

## 0.1.1

### Patch Changes

- b184196: Reject `__proto__`, `constructor` and `prototype` as path segments in
  `ObjectPathAccessor`, `SchemaIterator.mapField` and the Redis data source's
  nested update paths, closing the prototype-pollution code scanning alerts.

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this
baseline starts changelog tracking via
[Changesets](https://github.com/changesets/changesets).
