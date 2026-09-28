import { generateKeyPairSync } from 'crypto'
import Schema from 'mzen-schema'
import { SchemaEncryptionServiceRsa } from 'encryption/encryption-service-rsa'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('repo field decryption', () => {
  type User = {
    _id?: string
    secret: string
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const makeUserRepo = async (plaintext: string) => {
    const encryptionService = new SchemaEncryptionServiceRsa({
      publicKey,
      privateKey,
    })
    const schema = new Schema(
      { secret: { $type: String, $filter: { encrypt: true } } },
      { encryptionService }
    )

    const ciphertext = await encryptionService.encrypt(plaintext)
    const dataSource = new MockDataSource({
      user: [{ _id: '1', secret: ciphertext }],
    })

    const user = new Repo({
      name: 'user',
      schema,
    }) as Repo<User>
    user.dataSource = dataSource

    return user
  }

  it('decrypts a field fetched singly via findOne()', async () => {
    const user = await makeUserRepo('a-secret-value')
    const doc = await user.findOne({ _id: '1' })
    expect(doc.secret).toBe('a-secret-value')
  })

  it('decrypts the same field fetched as part of a list via find()', async () => {
    const user = await makeUserRepo('a-secret-value')
    const docs = await user.find()
    expect(docs[0].secret).toBe('a-secret-value')
  })
})
