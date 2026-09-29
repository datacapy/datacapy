<!-- cspell:ignore deserialisation -->

<!-- cspell:ignore OAEP pubout -->

# Field-Level Encryption

Opt-in at-rest encryption for individual schema fields. Encrypted values are
transparently encrypted before write and decrypted after read: no changes needed
in application code beyond configuration.

## Quick Start

```typescript
import fs from 'fs'
import { Schema, ModelManager, SchemaEncryptionServiceRsa } from '@datacapy/om'

const userSchema = new Schema({
  name: { $type: String },
  ssn: { $type: String, $filter: { encrypt: true } },
  email: { $type: String, $filter: { encrypt: true } },
})

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
Read:   dataSource → filterPrivate → applyTransients → applyDecrypt → populate
```

Each encrypted field uses a fresh random AES-256-GCM key. That key is encrypted
with RSA-OAEP and stored alongside the ciphertext as a base64-encoded JSON
payload:

```
base64( JSON({ k: rsaEncryptedAesKey, iv, tag, d: aesEncryptedData }) )
```

The private key is decrypted once at service construction and held in memory.

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

**Read-only nodes** (e.g. reporting replicas): omit `privateKey` from the
config. Encryption works normally; decryption throws
`'Private key not configured: decryption unavailable'`.

## Limitations

- **Not queryable by value**: the database stores ciphertext. Filtering on an
  encrypted field (e.g. `find({ ssn: '123-45-6789' })`) will not match.
- **String conversion**: values are stringified before encryption. Numeric or
  boolean fields will be returned as strings after decryption; handle
  deserialisation in the application layer.
- **Node.js only**: `SchemaEncryptionServiceRsa` uses the built-in `crypto`
  module. Custom implementations of `SchemaEncryptionService` can target other
  environments.
- **No built-in key rotation**: rotating keys requires re-encrypting all stored
  values outside of @datacapy/om.

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
