<!-- cspell:ignore Cipheriv Decipheriv subarray OAEP -->

# Field encryption

`mzen-schema` decides _which_ fields are encrypted and _when_. It does not ship
a cipher: you supply an encryption service, and the schema calls it for each
marked field.

## Marking fields

```ts
import { sb } from 'mzen-schema'

const spec = sb
  .schema('patient')
  .shape({
    name: sb.string(),
    ssn: sb.string().encrypt(),
    contact: sb.object({
      phone: sb.string().encrypt(),
      city: sb.string(),
    }),
  })
  .build()
```

`encrypt()` works on fields at any depth. Only string values are meant to be
encrypted, because the service interface takes and returns strings.

## The service interface

```ts
interface SchemaEncryptionService {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
}
```

Pass an implementation as `encryptionService` in the second argument to
`new Schema()`. A minimal service using Node's AES-256-GCM:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Schema, SchemaEncryptionService } from 'mzen-schema'

class AesService implements SchemaEncryptionService {
  constructor(private key: Buffer) {} // 32 bytes

  async encrypt(plaintext: string) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const data = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
  }

  async decrypt(ciphertext: string) {
    const raw = Buffer.from(ciphertext, 'base64')
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      raw.subarray(0, 12)
    )
    decipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([
      decipher.update(raw.subarray(28)),
      decipher.final(),
    ]).toString('utf8')
  }
}

const schema = new Schema(spec, {
  encryptionService: new AesService(randomBytes(32)),
})
```

In production, load the key from a secret store, never from source. For a
ready-made RSA-OAEP plus AES-256-GCM service with key management, see
[`mzen-om`'s field encryption](../../mzen-om/docs/encryption.md).

## Encrypting and decrypting

Encryption is explicit. `validate()` and `applyFilters()` never encrypt.

```ts
const patient = {
  name: 'A',
  ssn: '123-45-6789',
  contact: { phone: '0123', city: 'L' },
}

await schema.applyEncrypt(patient)
// patient.ssn and patient.contact.phone are now ciphertext; name and city are unchanged

await schema.applyDecrypt(patient)
// patient.ssn is '123-45-6789' again
```

| Method                     | Use                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `applyEncrypt(object)`     | Encrypt every marked field present in the object                                         |
| `applyDecrypt(object)`     | Reverse it                                                                               |
| `applyEncryptPaths(paths)` | Encrypt marked fields in a partial payload keyed by dotted path, such as a `$set` update |

All three modify the object in place and return it. A marked field that is
absent from the object is skipped.

Validate before encrypting, and decrypt after reading. Rules such as `email()`
or `maxLength()` cannot check ciphertext.

```ts
const result = await schema.validate(patient)
if (result.isValid) await schema.applyEncrypt(patient)
```

## Errors

If a schema has an encrypted field but no `encryptionService`, `applyEncrypt`
throws rather than storing plaintext:

```
Encryption required for field "ssn" but no encryptionService configured in schema
```

## With mzen-om

You normally do not call these methods yourself. `mzen-om` calls them on every
repository write and read, and lets you configure one service for all schemas.
See [its guide](../../mzen-om/docs/encryption.md).
