import Schema from 'schema'
import { SchemaEncryptionService } from 'encryption/encryption-service'

/**
 * A fake encryption service that simulates AAD-style context binding: it
 * "encrypts" by prefixing the context, and refuses to "decrypt" unless the
 * same context is supplied again - close enough to the real
 * SchemaEncryptionServiceRsa's contract to prove schema.ts plumbs the
 * field path through correctly on both sides.
 */
class FakeContextBoundEncryptionService implements SchemaEncryptionService {
  calls: Array<{ op: 'encrypt' | 'decrypt'; context?: string }> = []

  async encrypt(plaintext: string, context?: string): Promise<string> {
    this.calls.push({ op: 'encrypt', context })
    return `enc(${context ?? ''}):${plaintext}`
  }

  async decrypt(ciphertext: string, context?: string): Promise<string> {
    this.calls.push({ op: 'decrypt', context })
    const prefix = `enc(${context ?? ''}):`
    if (!ciphertext.startsWith(prefix)) {
      throw new Error('context mismatch')
    }
    return ciphertext.slice(prefix.length)
  }
}

describe('Schema encryption context plumbing', () => {
  it('applyEncrypt/applyDecrypt pass the field path as context, round-tripping correctly', async () => {
    const service = new FakeContextBoundEncryptionService()
    const schema = new Schema(
      { secret: { $type: String, $filter: { encrypt: true } } },
      { encryptionService: service }
    )

    const data: { secret?: string } = { secret: 'plaintext-value' }
    await schema.applyEncrypt(data)
    expect(data.secret).toBe('enc(secret):plaintext-value')

    await schema.applyDecrypt(data)
    expect(data.secret).toBe('plaintext-value')

    expect(service.calls).toEqual([
      { op: 'encrypt', context: 'secret' },
      { op: 'decrypt', context: 'secret' },
    ])
  })

  it('applyEncryptPaths passes the same path context as applyEncrypt for the same field', async () => {
    const service = new FakeContextBoundEncryptionService()
    const schema = new Schema(
      { secret: { $type: String, $filter: { encrypt: true } } },
      { encryptionService: service }
    )

    await schema.applyEncryptPaths({ secret: 'plaintext-value' })

    expect(service.calls).toEqual([{ op: 'encrypt', context: 'secret' }])
  })

  it('passes distinct context per nested field, and decrypting with the wrong one fails', async () => {
    const service = new FakeContextBoundEncryptionService()
    const schema = new Schema(
      {
        profile: {
          $type: Object,
          $spec: {
            secretA: { $type: String, $filter: { encrypt: true } },
          },
        },
        secretB: { $type: String, $filter: { encrypt: true } },
      },
      { encryptionService: service }
    )

    const data = { profile: { secretA: 'a-value' }, secretB: 'b-value' }
    await schema.applyEncrypt(data)

    expect(data.profile.secretA).toBe('enc(profile.secretA):a-value')
    expect(data.secretB).toBe('enc(secretB):b-value')

    // Simulate ciphertext substitution: move secretB's value onto secretA.
    const tampered = {
      profile: { secretA: data.secretB },
      secretB: data.secretB,
    }
    await expect(schema.applyDecrypt(tampered)).rejects.toThrow()
  })
})
