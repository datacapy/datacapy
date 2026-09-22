import { generateKeyPairSync } from 'crypto'
import { SchemaEncryptionServiceRsa } from './encryption-service-rsa'

describe('SchemaEncryptionServiceRsa', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const makeService = () =>
    new SchemaEncryptionServiceRsa({ publicKey, privateKey })

  it('round-trips a value with no context', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt('hello world')
    expect(ciphertext).not.toContain('hello world')
    const plaintext = await service.decrypt(ciphertext)
    expect(plaintext).toBe('hello world')
  })

  it('round-trips a value bound to a context, when the same context is supplied on decrypt', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt(
      'secret-value',
      'user.twoFactorSecret'
    )
    const plaintext = await service.decrypt(ciphertext, 'user.twoFactorSecret')
    expect(plaintext).toBe('secret-value')
  })

  it('fails to decrypt when the context does not match what it was encrypted with', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt('secret-value', 'fieldA')
    await expect(service.decrypt(ciphertext, 'fieldB')).rejects.toThrow()
  })

  it('fails to decrypt a context-bound value when decrypted with no context at all', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt('secret-value', 'fieldA')
    await expect(service.decrypt(ciphertext)).rejects.toThrow()
  })

  it('rejects ciphertext moved from one field to another (the exact substitution the AAD binding closes)', async () => {
    const service = makeService()
    const ciphertextForFieldA = await service.encrypt('fieldA-secret', 'fieldA')
    // An attacker (or a bug) copies fieldA's stored value into fieldB.
    await expect(
      service.decrypt(ciphertextForFieldA, 'fieldB')
    ).rejects.toThrow()
  })

  it('detects tampering with the ciphertext bytes (auth tag check)', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt('secret-value')
    const envelope = JSON.parse(
      Buffer.from(ciphertext, 'base64').toString('utf8')
    )
    const dBuf = Buffer.from(envelope.d, 'base64')
    dBuf[0] = dBuf[0] ^ 0xff
    envelope.d = dBuf.toString('base64')
    const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64')
    await expect(service.decrypt(tampered)).rejects.toThrow()
  })

  it('detects tampering with the RSA-wrapped key', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt('secret-value')
    const envelope = JSON.parse(
      Buffer.from(ciphertext, 'base64').toString('utf8')
    )
    const kBuf = Buffer.from(envelope.k, 'base64')
    kBuf[0] = kBuf[0] ^ 0xff
    envelope.k = kBuf.toString('base64')
    const tampered = Buffer.from(JSON.stringify(envelope)).toString('base64')
    await expect(service.decrypt(tampered)).rejects.toThrow()
  })

  it('throws on decrypt when no private key is configured', async () => {
    const readOnlyService = new SchemaEncryptionServiceRsa({ publicKey })
    const encryptService = makeService()
    const ciphertext = await encryptService.encrypt('secret-value')
    await expect(readOnlyService.decrypt(ciphertext)).rejects.toThrow(
      'Private key not configured'
    )
  })

  it('treats a non-envelope-shaped value as legacy plaintext and returns it unchanged', async () => {
    const service = makeService()
    const notAnEnvelope = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
      'base64'
    )
    const result = await service.decrypt(notAnEnvelope)
    expect(result).toBe(notAnEnvelope)
  })

  it('decrypts a pre-existing (no-AAD, no v marker) envelope correctly even though a context is supplied', async () => {
    // Simulates a value encrypted before the AAD binding existed: no `v`
    // field, no AAD ever set. Must still decrypt when a caller now always
    // passes a context (schema.ts always passes the field path) - the `v`
    // check must gate whether AAD is applied, not the mere presence of a
    // context argument.
    const service = makeService()
    const legacyCiphertext = await encryptLegacyNoAad(service, 'legacy-secret')
    const plaintext = await service.decrypt(
      legacyCiphertext,
      'user.twoFactorSecret'
    )
    expect(plaintext).toBe('legacy-secret')
  })
})

/**
 * Simulates a value encrypted by the pre-AAD implementation: no `v` field.
 * Encrypting with no context already produces an empty-AAD auth tag
 * (equivalent to GCM's "no AAD" state), so stripping `v` from that envelope
 * is indistinguishable from one genuinely encrypted without ever calling
 * `setAAD()` - decrypt() skips `setAAD()` entirely whenever `v !== 2`.
 */
async function encryptLegacyNoAad(
  service: SchemaEncryptionServiceRsa,
  plaintext: string
): Promise<string> {
  const withV = await service.encrypt(plaintext)
  const envelope = JSON.parse(Buffer.from(withV, 'base64').toString('utf8'))
  delete envelope.v
  return Buffer.from(JSON.stringify(envelope)).toString('base64')
}
