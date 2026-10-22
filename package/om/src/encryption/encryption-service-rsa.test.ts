import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
} from 'crypto'
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

  describe('wire compatibility and asynchrony', () => {
    const oaep = {
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }

    it('decrypts a key wrapped with the synchronous node API', async () => {
      const service = makeService()
      const envelope = JSON.parse(
        Buffer.from(await service.encrypt('interop'), 'base64').toString()
      )
      const aesKey = privateDecrypt(
        { key: privateKey, ...oaep },
        Buffer.from(envelope.k, 'base64')
      )
      envelope.k = publicEncrypt({ key: publicKey, ...oaep }, aesKey).toString(
        'base64'
      )
      const rewritten = Buffer.from(JSON.stringify(envelope)).toString('base64')
      expect(await service.decrypt(rewritten)).toBe('interop')
    })

    it('wraps keys that the synchronous node API can unwrap', async () => {
      const envelope = JSON.parse(
        Buffer.from(await makeService().encrypt('x'), 'base64').toString()
      )
      const aesKey = privateDecrypt(
        { key: privateKey, ...oaep },
        Buffer.from(envelope.k, 'base64')
      )
      expect(aesKey).toHaveLength(32)
    })

    it('keeps the event loop free during parallel decrypts', async () => {
      const big = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      const service = new SchemaEncryptionServiceRsa(big)
      const values = await Promise.all(
        Array.from({ length: 4 }, (_, i) => service.encrypt(`v${i}`))
      )
      let ticks = 0
      let running = true
      const tick = () => {
        if (!running) return
        ticks++
        setImmediate(tick)
      }
      setImmediate(tick)
      const out = await Promise.all(values.map((v) => service.decrypt(v)))
      running = false
      expect(out).toEqual(['v0', 'v1', 'v2', 'v3'])
      expect(ticks).toBeGreaterThan(0)
    }, 60_000)

    it('decrypts concurrently on first use', async () => {
      const writer = makeService()
      const values = await Promise.all(
        Array.from({ length: 5 }, (_, i) => writer.encrypt(`c${i}`))
      )
      const reader = makeService()
      expect(await Promise.all(values.map((v) => reader.decrypt(v)))).toEqual([
        'c0',
        'c1',
        'c2',
        'c3',
        'c4',
      ])
    })
  })

  describe('key rotation', () => {
    const makePair = () =>
      generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
    const pairB = makePair()
    const keyA = { id: 'a', publicKey, privateKey }
    const keyB = { id: 'b', ...pairB }

    const readEnvelope = (ciphertext: string) =>
      JSON.parse(Buffer.from(ciphertext, 'base64').toString('utf8'))
    const writeEnvelope = (envelope: object) =>
      Buffer.from(JSON.stringify(envelope)).toString('base64')

    it('stamps a v2 envelope with the key id', async () => {
      const envelope = readEnvelope(await makeService().encrypt('x'))
      expect(envelope.v).toBe(2)
      expect(envelope.kid).toBe('default')
    })

    it('decrypts a legacy v1 envelope (no kid) as the default key', async () => {
      const service = makeService()
      const envelope = readEnvelope(await service.encrypt('legacy'))
      delete envelope.v
      delete envelope.kid
      expect(await service.decrypt(writeEnvelope(envelope))).toBe('legacy')
    })

    it('throws a clear error for an unknown kid', async () => {
      const service = makeService()
      const envelope = readEnvelope(await service.encrypt('x'))
      envelope.kid = 'nope'
      await expect(service.decrypt(writeEnvelope(envelope))).rejects.toThrow(
        'Unknown encryption key id "nope"'
      )
    })

    it('rejects an envelope version from the future', async () => {
      const service = makeService()
      const envelope = readEnvelope(await service.encrypt('x'))
      envelope.v = 3
      await expect(service.decrypt(writeEnvelope(envelope))).rejects.toThrow(
        'Unsupported encryption envelope version 3'
      )
    })

    it('round-trips with two keys and still reads old values after the active key switches', async () => {
      const onA = new SchemaEncryptionServiceRsa({
        keys: [keyA, keyB],
        activeKeyId: 'a',
      })
      const onB = new SchemaEncryptionServiceRsa({
        keys: [keyA, keyB],
        activeKeyId: 'b',
      })
      const oldValue = await onA.encrypt('old')
      const newValue = await onB.encrypt('new')
      expect(readEnvelope(oldValue).kid).toBe('a')
      expect(readEnvelope(newValue).kid).toBe('b')
      expect(await onB.decrypt(oldValue)).toBe('old')
      expect(await onB.decrypt(newValue)).toBe('new')
    })

    it('rejects duplicate ids, a bad id and an unknown activeKeyId', () => {
      expect(
        () =>
          new SchemaEncryptionServiceRsa({
            keys: [keyA, keyA],
            activeKeyId: 'a',
          })
      ).toThrow('Duplicate key id')
      expect(
        () =>
          new SchemaEncryptionServiceRsa({
            keys: [{ ...keyA, id: 'bad id' }],
            activeKeyId: 'bad id',
          })
      ).toThrow('Invalid key id')
      expect(
        () => new SchemaEncryptionServiceRsa({ keys: [keyA], activeKeyId: 'z' })
      ).toThrow('activeKeyId "z"')
    })

    it('fails when the kid is tampered to another known key', async () => {
      const service = new SchemaEncryptionServiceRsa({
        keys: [keyA, keyB],
        activeKeyId: 'a',
      })
      const envelope = readEnvelope(await service.encrypt('x'))
      envelope.kid = 'b'
      await expect(service.decrypt(writeEnvelope(envelope))).rejects.toThrow()
    })

    it('fails for a retired key that has no private half', async () => {
      const onA = new SchemaEncryptionServiceRsa({
        keys: [keyA],
        activeKeyId: 'a',
      })
      const value = await onA.encrypt('x')
      const noPrivate = new SchemaEncryptionServiceRsa({
        keys: [{ id: 'a', publicKey }, keyB],
        activeKeyId: 'b',
      })
      await expect(noPrivate.decrypt(value)).rejects.toThrow(
        'Private key not configured for key id "a"'
      )
    })

    describe('rewrap', () => {
      const both = (activeKeyId: string) =>
        new SchemaEncryptionServiceRsa({ keys: [keyA, keyB], activeKeyId })

      it('moves a value to the active key without touching iv, tag or d', async () => {
        const value = await both('a').encrypt('secret')
        const rewrapped = await both('b').rewrap(value)
        expect(rewrapped).not.toBeNull()
        const before = readEnvelope(value)
        const after = readEnvelope(rewrapped!)
        expect(after.kid).toBe('b')
        expect(after.k).not.toBe(before.k)
        expect({ iv: after.iv, tag: after.tag, d: after.d }).toEqual({
          iv: before.iv,
          tag: before.tag,
          d: before.d,
        })
        expect(await both('b').decrypt(rewrapped!)).toBe('secret')
        // The old key is no longer needed to read it.
        const onlyB = new SchemaEncryptionServiceRsa({
          keys: [{ id: 'a', publicKey }, keyB],
          activeKeyId: 'b',
        })
        expect(await onlyB.decrypt(rewrapped!)).toBe('secret')
      })

      it('returns null when already on the active key', async () => {
        const value = await both('b').encrypt('x')
        expect(await both('b').rewrap(value)).toBeNull()
      })

      it('returns null for legacy plaintext', async () => {
        expect(await both('b').rewrap('just text')).toBeNull()
      })

      it('upgrades a v1 envelope on the default key to v2', async () => {
        const service = makeService()
        const envelope = readEnvelope(await service.encrypt('legacy'))
        delete envelope.v
        delete envelope.kid
        const rewrapped = await service.rewrap(writeEnvelope(envelope))
        expect(readEnvelope(rewrapped!).v).toBe(2)
        expect(await service.decrypt(rewrapped!)).toBe('legacy')
      })
    })
  })
})
