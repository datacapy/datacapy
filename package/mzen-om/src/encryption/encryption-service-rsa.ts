import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  KeyObject,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'crypto'
import { SchemaEncryptionService } from 'mzen-schema'

export interface SchemaEncryptionServiceRsaConfig {
  publicKey: string
  privateKey?: string
  privateKeyPassword?: string
}

/**
 * RSA+AES-256-GCM hybrid encryption.
 *
 * A random AES key encrypts the field value; RSA-OAEP encrypts the AES key.
 * The private key is decrypted once at construction using the supplied password
 * and held in memory for the lifetime of the service.
 */
export class SchemaEncryptionServiceRsa implements SchemaEncryptionService {
  private publicKey: KeyObject
  private privateKey?: KeyObject

  constructor(config: SchemaEncryptionServiceRsaConfig) {
    this.publicKey = createPublicKey(config.publicKey)
    if (config.privateKey) {
      this.privateKey = createPrivateKey({
        key: config.privateKey,
        format: 'pem',
        passphrase: config.privateKeyPassword,
      })
    }
  }

  async encrypt(plaintext: string, context?: string): Promise<string> {
    const aesKey = randomBytes(32)
    const iv = randomBytes(12)

    const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
    // Binds the ciphertext to its context (the schema layer passes the
    // field's path) via GCM's additional authenticated data, so a value
    // copied to a different field/document fails to decrypt instead of
    // silently succeeding. `v: 2` marks this envelope as AAD-aware, so
    // decrypt() knows to apply the same binding - envelopes written before
    // this existed (no `v`) never had AAD and must not have it required now.
    cipher.setAAD(Buffer.from(context ?? '', 'utf8'))
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()

    const encryptedKey = publicEncrypt(
      {
        key: this.publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey
    )

    const payload = JSON.stringify({
      v: 2,
      k: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
      d: encrypted.toString('base64'),
    })

    return Buffer.from(payload).toString('base64')
  }

  async decrypt(ciphertext: string, context?: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not configured — decryption unavailable')
    }

    // Detect legacy plaintext values stored before encryption was introduced.
    // The encryption envelope is base64(JSON{k,iv,tag,d}). If the value doesn't
    // decode to that structure it's a legacy value — return it unchanged.
    let payload: { v?: number; k: string; iv: string; tag: string; d: string }
    try {
      const decoded = Buffer.from(ciphertext, 'base64').toString('utf8')
      payload = JSON.parse(decoded)
    } catch {
      return ciphertext
    }
    if (!payload?.k || !payload?.iv || !payload?.tag || !payload?.d) {
      return ciphertext
    }

    const aesKey = privateDecrypt(
      {
        key: this.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(payload.k, 'base64')
    )

    const decipher = createDecipheriv(
      'aes-256-gcm',
      aesKey,
      Buffer.from(payload.iv, 'base64')
    )
    // Only envelopes written by the AAD-aware encrypt() above (v: 2) ever
    // had AAD set - anything older must not have it applied on decrypt, or
    // the auth tag check below would fail for every value already stored
    // under the pre-existing (no-AAD) scheme.
    if (payload.v === 2) {
      decipher.setAAD(Buffer.from(context ?? '', 'utf8'))
    }
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.d, 'base64')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  }
}
