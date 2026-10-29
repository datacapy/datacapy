<!-- cspell:ignore deserialisation -->

<!-- cspell:ignore OAEP pubout -->

# Field-Level Encryption

Opt-in at-rest encryption for individual schema fields. Encrypted values are
encrypted before write. Reads return them encrypted unless the query asks for
decryption (see [Opt-in decryption](#opt-in-decryption)).

## Quick Start

```typescript
import fs from 'fs'
import {
  Schema,
  sb,
  ModelManager,
  SchemaEncryptionServiceRsa,
} from '@datacapy/om'

const userSchema = new Schema(
  sb.schema('user').shape({
    name: sb.string(),
    ssn: sb.string().encrypt(),
    email: sb.string().encrypt(),
  })
)

const modelManager = new ModelManager({
  schemas: [userSchema],
  repos: [repoUser],
  encryptionService: new SchemaEncryptionServiceRsa({
    publicKey: fs.readFileSync('./keys/public.pem', 'utf8'),
    privateKey: fs.readFileSync('./keys/private.pem', 'utf8'),
    privateKeyPassword: process.env.PRIVATE_KEY_PASSWORD,
  }),
})

await modelManager.init()
```

Fields marked `$filter: { encrypt: true }` are stored encrypted; all other
fields are unaffected.

## How It Works

```
Write:  insert/update → applyEncrypt(applyEncryptPaths for $set) → validate → dataSource
Read:   dataSource → filterPrivate → applyTransients → applyDecrypt (only if requested) → populate
```

Each encrypted field uses a fresh random AES-256-GCM key. That key is encrypted
with RSA-OAEP and stored alongside the ciphertext as a base64-encoded JSON
payload:

```
base64( JSON({ v: 2, kid, k: rsaEncryptedAesKey, iv, tag, d: aesEncryptedData }) )
```

`kid` names the RSA key that wrapped `k`. Envelopes written before key ids
existed have no `v` or `kid` and are read as the key with id `default`.

The private key is decrypted once at service construction and held in memory.

## Opt-in decryption

Each decrypt is an RSA operation, so reads leave encrypted fields as ciphertext
by default. Ask for plaintext where it is needed:

```typescript
// per query: decrypts every encrypted field of the result, and of populated relations
const user = await repoUser.findOne({ _id }, { decrypt: true })

// after the fact, on documents read without decryption (safe on decrypted ones)
await repoUser.decrypt(user)
```

A field that should always come back decrypted, as before, opts in on the
schema: `ssn: { $type: String, $filter: { encrypt: { eager: true } } }` (or
`.encrypt({ eager: true })` on a builder). `decrypt: true` on a query still
decrypts the other fields.

Writing a value that is already an envelope, for example a field carried over
from a document read without decryption, stores it unchanged instead of
encrypting it again. This needs the service to implement the optional
`isEncrypted(value)`; `SchemaEncryptionServiceRsa` does. A service without it
encrypts every value it is given.

### Ciphertext, plaintext and redaction

Three things can come back for an encrypted field, and each has its own switch:

| You want                        | Use                                                          |
| ------------------------------- | ------------------------------------------------------------ |
| The stored value (ciphertext)   | the default                                                  |
| Plaintext                       | `decrypt: true`, or `repo.decrypt(doc)`                      |
| Nothing, for output to a client | `.privateValue()` or `.private()` with `filterPrivate: true` |

Redaction is independent of decryption. See
[filtering](../../schema/docs/filtering.md) for `filterPrivate`.

### Migrating from always-decrypt

Reads that need plaintext must now pass `decrypt: true`, or the field must be
declared `eager`. A caller that forgets receives the ciphertext envelope.
`findGroup` never decrypts.

## Configuration

### ModelManager level (recommended)

Configure once; the service is propagated to every schema that does not have its
own `encryptionService`:

```typescript
new ModelManager({ encryptionService: myService })
```

### Schema level (per-schema override)

```typescript
new Schema(spec, { encryptionService: myService })
```

Schema-level config takes precedence over ModelManager config.

## Key Management

Generate a password-protected RSA key pair:

```bash
# Generate 4096-bit private key with AES-256 passphrase
openssl genrsa -aes256 -out private.pem 4096

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem
```

Provide the passphrase via an environment variable: never hard-code it.

## Key Rotation

Configure several keys and name the one used for new values. A key id (`kid`)
matches `[A-Za-z0-9._-]{1,64}`; duplicate ids, an `activeKeyId` that is not in
`keys` and an invalid id are rejected at construction.

```typescript
new SchemaEncryptionServiceRsa({
  keys: [
    {
      id: '2025',
      publicKey: oldPublic,
      privateKey: oldPrivate,
      privateKeyPassword,
    },
    {
      id: '2026',
      publicKey: newPublic,
      privateKey: newPrivate,
      privateKeyPassword,
    },
  ],
  activeKeyId: '2026',
})
```

The single-key form is the same as one key with id `default`. Decryption picks
the key by `kid` and throws `Unknown encryption key id "x"` when it is not
configured. Every node must run a build that reads `v: 2` before any node writes
it, because an older build cannot parse a v2 envelope.

`rewrap(ciphertext)` unwraps the AES key with the old private key and wraps it
again with the active public key. `iv`, `tag` and `d` do not change and
plaintext is never produced. It returns `null` when the value is already on the
active key or is legacy plaintext. `rewrap` is optional on
`SchemaEncryptionService`, so a KMS-backed service need not implement it.

`EncryptionReencryptor` applies `rewrap` to every encrypted field of a repo:

```typescript
const report = await new EncryptionReencryptor(repo, service).run({
  batchSize: 100,
  dryRun: false,
  afterId: previous?.lastId,
})
// { scanned, rewrapped, skipped, failed, byKid, lastId, done }
```

It reads and writes raw stored values through the data source, so nothing is
double-encrypted. A document is written only when all its fields rewrapped, and
only if they still hold the values that were read. A failing document is counted
in `failed` and left as it was. A second run rewrites nothing, and a run resumes
from `lastId`. `byKid` counts values per key before the run changed them: retire
a key only when it reads zero, including in any backup that could be restored.
Take a database backup first.

**Read-only nodes** (e.g. reporting replicas): omit `privateKey` from the
config. Encryption works normally; decryption throws
`'Private key not configured: decryption unavailable'`.

## Limitations

- **Not queryable by value**: the database stores ciphertext. Filtering on an
  encrypted field (e.g. `find({ ssn: '123-45-6789' })`) will not match.
- **String conversion**: values are stringified before encryption. Numeric or
  boolean fields will be returned as strings after decryption; handle
  deserialisation in the application layer.
- **Thread pool bound**: RSA runs through WebCrypto on the libuv thread pool, so
  the event loop stays free, but `UV_THREADPOOL_SIZE` (default 4) caps parallel
  RSA operations. Raise it under heavy read load.
- **Node.js only**: `SchemaEncryptionServiceRsa` uses the built-in `crypto`
  module. Custom implementations of `SchemaEncryptionService` can target other
  environments.
- **Envelope not bound to its field**: the ciphertext is not tied to its
  document or field (no AAD), so a value can be copied between fields.

## Custom Encryption Service

Implement `SchemaEncryptionService` from `@datacapy/schema` to use a different
algorithm or key store (e.g. AWS KMS, HashiCorp Vault):

```typescript
import { SchemaEncryptionService } from '@datacapy/schema'

export class KmsEncryptionService implements SchemaEncryptionService {
  async encrypt(plaintext: string): Promise<string> {
    /* ... */
  }
  async decrypt(ciphertext: string): Promise<string> {
    /* ... */
  }
}
```

## Source References

- [`@datacapy/schema/src/encryption/encryption-service.ts`](../../schema/src/encryption/encryption-service.ts):
  `SchemaEncryptionService` interface
- [`@datacapy/om/src/encryption/encryption-service-rsa.ts`](../src/encryption/encryption-service-rsa.ts):
  RSA+AES-256-GCM implementation
- [`@datacapy/schema/src/spec.ts`](../../schema/src/spec.ts):
  `SchemaSpecFilter.encrypt` field
- [`@datacapy/schema/src/schema.ts`](../../schema/src/schema.ts):
  `applyEncrypt`, `applyEncryptPaths`, `applyDecrypt`
- [`@datacapy/om/src/model-manager.ts`](../src/model-manager.ts):
  `ModelManagerConfig.encryptionService`, propagation in `initSchemas`
- [`@datacapy/om/src/repo/index.ts`](../src/repo/index.ts): call sites in
  insert, update, and find paths

<!-- cspell:ignore libuv THREADPOOL -->
