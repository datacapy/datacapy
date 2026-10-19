import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  KeyObject,
  randomBytes,
  subtle,
  webcrypto,
} from 'crypto'
import { SchemaEncryptionService } from '@datacapy/schema'

export interface SchemaEncryptionServiceRsaConfig {
  publicKey: string
  privateKey?: string
  privateKeyPassword?: string
}

export interface SchemaEncryptionServiceRsaKeyConfig extends SchemaEncryptionServiceRsaConfig {
  id: string
}

export interface SchemaEncryptionServiceRsaMultiConfig {
  keys: SchemaEncryptionServiceRsaKeyConfig[]
  activeKeyId: string
}

interface RsaKeyEntry {
  publicKey: KeyObject
  privateKey?: KeyObject
  // Imported on first use and memoised, so the constructor stays synchronous
  // and concurrent first calls share one import.
  publicCryptoKey?: Promise<webcrypto.CryptoKey>
  privateCryptoKey?: Promise<webcrypto.CryptoKey>
}

interface Envelope {
  v?: number
  kid?: string
  k: string
  iv: string
  tag: string
  d: string
}

const LEGACY_KEY_ID = 'default'
const ENVELOPE_VERSION = 2
const RSA_OAEP = { name: 'RSA-OAEP', hash: 'SHA-256' } as const
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

/**
 * RSA+AES-256-GCM hybrid encryption with key rotation.
 *
 * A random AES key encrypts the field value; RSA-OAEP encrypts the AES key.
 * Each envelope names the key that wrapped it (`kid`), so several keys can be
 * configured at once: new values use the active key, old values still decrypt
 * with the key they were written under. Envelopes written before key ids
 * existed carry no `kid` and are read as the key with id `default`.
 *
 * Private keys are decrypted once at construction using the supplied password
 * and held in memory for the lifetime of the service.
 *
 * RSA runs through WebCrypto, which executes on the libuv thread pool, so the
 * event loop stays free. `UV_THREADPOOL_SIZE` (default 4) caps parallel RSA
 * operations.
 */
export class SchemaEncryptionServiceRsa implements SchemaEncryptionService {
  private keys = new Map<string, RsaKeyEntry>()
  private activeKeyId: string

  constructor(
    config:
      SchemaEncryptionServiceRsaConfig | SchemaEncryptionServiceRsaMultiConfig
  ) {
    const multi = this.toMultiConfig(config)
    for (const key of multi.keys) {
      this.addKey(key)
    }
    const active = this.keys.get(multi.activeKeyId)
    if (!active) {
      throw new Error(
        `activeKeyId "${multi.activeKeyId}" is not in the configured keys`
      )
    }
    this.activeKeyId = multi.activeKeyId
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

    return this.serialise({
      v: ENVELOPE_VERSION,
      kid: this.activeKeyId,
      k: await this.wrapKey(this.keys.get(this.activeKeyId)!, aesKey),
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
      d: encrypted.toString('base64'),
    })
  }

  async decrypt(ciphertext: string): Promise<string> {
    // Detect legacy plaintext values stored before encryption was introduced:
    // a value that does not decode to an envelope is returned unchanged.
    const envelope = this.parseEnvelope(ciphertext)
    if (!envelope) {
      // Keep the historic error for a read-only node, even for plaintext it
      // would pass through.
      this.requireAnyPrivateKey()
      return ciphertext
    }

    const aesKey = await this.unwrapKey(envelope)

    const decipher = createDecipheriv(
      'aes-256-gcm',
      aesKey,
      Buffer.from(envelope.iv, 'base64')
    )
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.d, 'base64')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  }

  /**
   * Re-wrap the AES key of an envelope under the active key. `iv`, `tag` and
   * `d` are untouched and plaintext is never produced. Returns null when the
   * value is already on the active key or is legacy plaintext.
   */
  async rewrap(ciphertext: string): Promise<string | null> {
    const envelope = this.parseEnvelope(ciphertext)
    if (!envelope) return null
    if (envelope.v === ENVELOPE_VERSION && envelope.kid === this.activeKeyId) {
      return null
    }
    // An unversioned envelope is on `default`; it only counts as current when
    // that is also the active key, and it still needs re-stamping as v2.
    const aesKey = await this.unwrapKey(envelope)
    return this.serialise({
      v: ENVELOPE_VERSION,
      kid: this.activeKeyId,
      k: await this.wrapKey(this.keys.get(this.activeKeyId)!, aesKey),
      iv: envelope.iv,
      tag: envelope.tag,
      d: envelope.d,
    })
  }

  isEncrypted(value: string): boolean {
    return this.parseEnvelope(value) !== null
  }

  /** The key id an envelope was written under, or null for legacy plaintext. */
  keyIdOf(ciphertext: string): string | null {
    const envelope = this.parseEnvelope(ciphertext)
    return envelope ? (envelope.kid ?? LEGACY_KEY_ID) : null
  }

  private toMultiConfig(
    config:
      SchemaEncryptionServiceRsaConfig | SchemaEncryptionServiceRsaMultiConfig
  ): SchemaEncryptionServiceRsaMultiConfig {
    if ('keys' in config) return config
    return {
      keys: [{ id: LEGACY_KEY_ID, ...config }],
      activeKeyId: LEGACY_KEY_ID,
    }
  }

  private addKey(config: SchemaEncryptionServiceRsaKeyConfig): void {
    if (!KEY_ID_PATTERN.test(config.id ?? '')) {
      throw new Error(
        `Invalid key id "${config.id}": must match ${KEY_ID_PATTERN}`
      )
    }
    if (this.keys.has(config.id)) {
      throw new Error(`Duplicate key id "${config.id}"`)
    }
    this.keys.set(config.id, {
      publicKey: createPublicKey(config.publicKey),
      privateKey: config.privateKey
        ? createPrivateKey({
            key: config.privateKey,
            format: 'pem',
            passphrase: config.privateKeyPassword,
          })
        : undefined,
    })
  }

  private requireAnyPrivateKey(): void {
    for (const key of this.keys.values()) {
      if (key.privateKey) return
    }
    throw new Error('Private key not configured — decryption unavailable')
  }

  private parseEnvelope(ciphertext: string): Envelope | null {
    let payload: Envelope
    try {
      payload = JSON.parse(Buffer.from(ciphertext, 'base64').toString('utf8'))
    } catch {
      return null
    }
    if (!payload?.k || !payload?.iv || !payload?.tag || !payload?.d) {
      return null
    }
    if (payload.v !== undefined && payload.v > ENVELOPE_VERSION) {
      throw new Error(`Unsupported encryption envelope version ${payload.v}`)
    }
    return payload
  }

  private async unwrapKey(envelope: Envelope): Promise<Buffer> {
    const kid = envelope.kid ?? LEGACY_KEY_ID
    const key = this.keys.get(kid)
    if (!key) {
      throw new Error(`Unknown encryption key id "${kid}"`)
    }
    if (!key.privateKey) {
      throw new Error(
        `Private key not configured for key id "${kid}" — decryption unavailable`
      )
    }
    key.privateCryptoKey ??= subtle.importKey(
      'pkcs8',
      key.privateKey.export({ type: 'pkcs8', format: 'der' }),
      RSA_OAEP,
      false,
      ['decrypt']
    )
    const unwrapped = await subtle.decrypt(
      RSA_OAEP,
      await key.privateCryptoKey,
      Buffer.from(envelope.k, 'base64')
    )
    return Buffer.from(unwrapped)
  }

  private async wrapKey(key: RsaKeyEntry, aesKey: Buffer): Promise<string> {
    key.publicCryptoKey ??= subtle.importKey(
      'spki',
      key.publicKey.export({ type: 'spki', format: 'der' }),
      RSA_OAEP,
      false,
      ['encrypt']
    )
    const wrapped = await subtle.encrypt(
      RSA_OAEP,
      await key.publicCryptoKey,
      new Uint8Array(aesKey)
    )
    return Buffer.from(wrapped).toString('base64')
  }

  private serialise(envelope: Envelope): string {
    return Buffer.from(JSON.stringify(envelope)).toString('base64')
  }
}
