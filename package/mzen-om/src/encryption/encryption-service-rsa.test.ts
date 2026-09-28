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

  it('round-trips a value', async () => {
    const service = makeService()
    const ciphertext = await service.encrypt('hello world')
    expect(ciphertext).not.toContain('hello world')
    const plaintext = await service.decrypt(ciphertext)
    expect(plaintext).toBe('hello world')
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
})
