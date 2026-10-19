import { generateKeyPairSync } from 'crypto'
import Schema from '@datacapy/schema'
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

  const makeUserRepo = async (
    plaintext: string,
    encrypt: boolean | { eager?: boolean } = true
  ) => {
    const encryptionService = new SchemaEncryptionServiceRsa({
      publicKey,
      privateKey,
    })
    const schema = new Schema(
      { secret: { $type: String, $filter: { encrypt } } },
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

    return { user, dataSource, encryptionService, ciphertext }
  }

  it('decrypts a field fetched singly via findOne() when asked', async () => {
    const { user } = await makeUserRepo('a-secret-value')
    const doc = await user.findOne({ _id: '1' }, { decrypt: true })
    expect(doc.secret).toBe('a-secret-value')
  })

  it('decrypts the same field fetched as part of a list via find() when asked', async () => {
    const { user } = await makeUserRepo('a-secret-value')
    const docs = await user.find({}, { decrypt: true })
    expect(docs[0].secret).toBe('a-secret-value')
  })

  it('leaves the field encrypted by default', async () => {
    const { user, ciphertext } = await makeUserRepo('a-secret-value')
    expect((await user.findOne({ _id: '1' })).secret).toBe(ciphertext)
    expect((await user.find())[0].secret).toBe(ciphertext)
  })

  it('leaves the field encrypted with decrypt: false', async () => {
    const { user, ciphertext } = await makeUserRepo('a-secret-value')
    const doc = await user.findOne({ _id: '1' }, { decrypt: false })
    expect(doc.secret).toBe(ciphertext)
  })

  it('decrypts an eager field by default', async () => {
    const { user } = await makeUserRepo('a-secret-value', { eager: true })
    const doc = await user.findOne({ _id: '1' })
    expect(doc.secret).toBe('a-secret-value')
  })

  it('decrypts afterwards with repo.decrypt(), and again harmlessly', async () => {
    const { user } = await makeUserRepo('a-secret-value')
    const doc = await user.findOne({ _id: '1' })
    await user.decrypt(doc)
    expect(doc.secret).toBe('a-secret-value')
    await user.decrypt(doc)
    expect(doc.secret).toBe('a-secret-value')
  })

  it('does not encrypt an already encrypted value written back', async () => {
    const { user, dataSource, ciphertext } =
      await makeUserRepo('a-secret-value')
    const doc = await user.findOne({ _id: '1' })
    await user.updateOne({ _id: '1' }, { $set: { secret: doc.secret } })
    expect(dataSource.dataUpdate[0].$set.secret).toBe(ciphertext)
  })

  it('still encrypts a plaintext value on write', async () => {
    const { user, dataSource, encryptionService } =
      await makeUserRepo('a-secret-value')
    await user.updateOne({ _id: '1' }, { $set: { secret: 'replaced' } })
    const written = dataSource.dataUpdate[0].$set.secret
    expect(written).not.toBe('replaced')
    expect(await encryptionService.decrypt(written)).toBe('replaced')
  })
  describe('populated relations', () => {
    type Owner = { _id?: string; name: string; account?: User }

    const makeOwnerRepo = async () => {
      const { user, dataSource, ciphertext } =
        await makeUserRepo('a-secret-value')
      dataSource.data.owner = [{ _id: '1', name: 'Kevin', accountId: '1' }]
      const owner = new Repo({
        name: 'owner',
        relations: {
          account: {
            type: 'belongsToOne',
            repo: 'user',
            key: 'accountId',
            alias: 'account',
            autoPopulate: true,
          },
        },
      }) as Repo<Owner>
      owner.dataSource = dataSource
      owner.repos.user = user
      return { owner, ciphertext }
    }

    it('decrypts the related document when asked', async () => {
      const { owner } = await makeOwnerRepo()
      const doc = await owner.findOne({ _id: '1' }, { decrypt: true })
      expect(doc.account?.secret).toBe('a-secret-value')
    })

    it('leaves the related document encrypted by default', async () => {
      const { owner, ciphertext } = await makeOwnerRepo()
      const doc = await owner.findOne({ _id: '1' })
      expect(doc.account?.secret).toBe(ciphertext)
    })
  })
})
