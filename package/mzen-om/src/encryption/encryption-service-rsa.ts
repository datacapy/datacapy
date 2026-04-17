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

  async encrypt(plaintext: string): Promise<string> {
    const aesKey = randomBytes(32)
    const iv = randomBytes(12)

    const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
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
      k: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
      d: encrypted.toString('base64'),
    })

    return Buffer.from(payload).toString('base64')
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not configured — decryption unavailable')
    }

    const payload = JSON.parse(
      Buffer.from(ciphertext, 'base64').toString('utf8')
    )

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
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.d, 'base64')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  }
}
