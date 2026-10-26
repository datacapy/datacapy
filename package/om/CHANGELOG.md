# @datacapy/om

## 1.1.0

### Minor Changes

- 356f3cd: Add `repib` (index) and `relb` (relation) builders. A repo's
  `indexes` and `relations` config accepts them directly, with no trailing
  `.build()`; plain config objects still work.
  `repib.desc('createdAt').timestamp()` sets the `TYPE_HINT_TIMESTAMP` hint Date
  index fields need, and `relb.hasMany('repo')` etc. replace the free-form
  relation `type` string. `RepoIndexConfig` also declares the `name` override it
  already read at runtime.

### Patch Changes

- Updated dependencies [dd068d4]
  - @datacapy/schema@1.1.0

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

### Patch Changes

- f9d3f02: `SchemaEncryptionServiceRsa` wraps and unwraps the AES key with
  WebCrypto RSA-OAEP instead of the synchronous
  `publicEncrypt`/`privateDecrypt`, so RSA runs on the libuv thread pool and no
  longer blocks the event loop. Envelopes are unchanged.

  <!-- cspell:ignore libuv OAEP -->

- Updated dependencies [3633ccc]
- Updated dependencies [7966276]
  - @datacapy/schema@1.0.0

## 0.3.0

### Minor Changes

- fe5ac90: Breaking: a string `$regex` operand is now a literal substring match
  instead of a regex. Regex syntax and the LIKE wildcards `%` and `_` in it are
  matched literally, so untrusted search text is safe to pass without escaping.
  Pass a `RegExp` object to opt in to real regex semantics.

### Patch Changes

- Updated dependencies [a3415b9]
  - @datacapy/schema@0.2.0

## 0.2.0

### Minor Changes

- b612078: Add `DataSourceRedis.duplicate(overrides?)`, which returns a new
  ioredis connection sharing the datasource options; `close()` quits all
  duplicates.

### Patch Changes

- e74dc02: Share the query context with relation population instead of
  deep-copying it. The context holds the transaction lease and its database
  connection, and copying it threw on Node 26, where socket properties are
  read-only, so any populate inside a transaction failed.
- b184196: Reject `__proto__`, `constructor` and `prototype` as path segments in
  `ObjectPathAccessor`, `SchemaIterator.mapField` and the Redis data source's
  nested update paths, closing the prototype-pollution code scanning alerts.
- Updated dependencies [b184196]
  - @datacapy/schema@0.1.1

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this
baseline starts changelog tracking via
[Changesets](https://github.com/changesets/changesets).
