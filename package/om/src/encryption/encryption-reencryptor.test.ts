import { generateKeyPairSync } from 'crypto'
import Schema from '@datacapy/schema'
import { SchemaEncryptionServiceRsa } from './encryption-service-rsa'
import { EncryptionReencryptor } from './encryption-reencryptor'
import Repo from '../repo'
import MockDataSource from '../data-source/mock'

type Row = Record<string, any>

// The stock mock ignores sort, comparison operators and update bodies.
class StoreDataSource extends MockDataSource {
  writes = 0

  async find(collection: string, query: Row = {}, options: Row = {}) {
    const rows = (this.data[collection] as Row[])
      .filter((row) => this.matches(row, query))
      .sort((a, b) => (a._id < b._id ? -1 : 1))
      .slice(0, options.limit)
    return JSON.parse(JSON.stringify(rows))
  }

  async updateOne(collection: string, query: Row, update: Row, _options?: any) {
    const row = (this.data[collection] as Row[]).find((r) =>
      this.matches(r, query)
    )
    if (!row) return { count: 0 }
    this.writes++
    Object.assign(row, update.$set)
    return { count: 1 }
  }

  private matches(row: Row, query: Row) {
    return Object.entries(query).every(([key, cond]) =>
      cond && typeof cond === 'object' ? row[key] > cond.$gt : row[key] === cond
    )
  }
}

describe('EncryptionReencryptor', () => {
  const makePair = () =>
    generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
  const keyA = { id: 'a', ...makePair() }
  const keyB = { id: 'b', ...makePair() }
  const serviceFor = (activeKeyId: string) =>
    new SchemaEncryptionServiceRsa({ keys: [keyA, keyB], activeKeyId })

  const setup = async (count = 5) => {
    const onA = serviceFor('a')
    const onB = serviceFor('b')
    const rows = []
    for (let i = 1; i <= count; i++) {
      rows.push({
        _id: String(i),
        name: `u${i}`,
        secret: await onA.encrypt(`s${i}`),
      })
    }
    // One row without a secret and one already on key b.
    rows.push({ _id: String(count + 1), name: 'none' })
    rows.push({
      _id: String(count + 2),
      name: 'b',
      secret: await onB.encrypt('sb'),
    })
    const dataSource = new StoreDataSource({ user: rows })
    const schema = new Schema(
      {
        name: { $type: String },
        secret: { $type: String, $filter: { encrypt: true } },
      },
      { encryptionService: onB }
    )
    const repo = new Repo({ name: 'user', schema }) as Repo<any>
    repo.dataSource = dataSource
    return { repo, dataSource, onB, rows }
  }

  const stored = async (dataSource: StoreDataSource) =>
    (await dataSource.find('user', {}, { sort: { _id: 1 } })) as any[]

  it('rewraps everything to the active key and preserves plaintext', async () => {
    const { repo, dataSource, onB } = await setup()
    const report = await new EncryptionReencryptor(repo, onB).run({
      batchSize: 2,
    })
    expect(report).toMatchObject({
      scanned: 7,
      rewrapped: 5,
      skipped: 2,
      failed: 0,
      done: true,
    })
    expect(report.byKid).toEqual({ a: 5, b: 1 })
    const docs = await repo.find({}, { sort: { _id: 1 } })
    expect(docs.filter((d) => d.secret).map((d) => d.secret)).toEqual([
      's1',
      's2',
      's3',
      's4',
      's5',
      'sb',
    ])
    for (const row of await stored(dataSource)) {
      if (row.secret) expect(onB.keyIdOf(row.secret)).toBe('b')
    }
  })

  it('is idempotent: a second run rewrites nothing', async () => {
    const { repo, dataSource, onB } = await setup()
    const reencryptor = new EncryptionReencryptor(repo, onB)
    await reencryptor.run()
    const before = JSON.stringify(await stored(dataSource))
    const second = await reencryptor.run()
    expect(second.rewrapped).toBe(0)
    expect(second.byKid).toEqual({ b: 6 })
    expect(JSON.stringify(await stored(dataSource))).toBe(before)
  })

  it('writes nothing on a dry run but still reports counts', async () => {
    const { repo, dataSource, onB } = await setup()
    const before = JSON.stringify(await stored(dataSource))
    const report = await new EncryptionReencryptor(repo, onB).run({
      dryRun: true,
    })
    expect(report.rewrapped).toBe(5)
    expect(report.byKid).toEqual({ a: 5, b: 1 })
    expect(JSON.stringify(await stored(dataSource))).toBe(before)
  })

  it('records a failing document, leaves it untouched and carries on', async () => {
    const { repo, dataSource, onB, rows } = await setup()
    const broken = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(rows[2].secret, 'base64').toString()),
        kid: 'gone',
      })
    ).toString('base64')
    await dataSource.updateOne(
      'user',
      { _id: '3' },
      { $set: { secret: broken } }
    )
    const report = await new EncryptionReencryptor(repo, onB).run()
    expect(report).toMatchObject({ rewrapped: 4, failed: 1 })
    expect((await stored(dataSource))[2].secret).toBe(broken)
    expect((await repo.findOne({ _id: '1' })).secret).toBe('s1')
  })

  it('resumes from lastId', async () => {
    const { repo, onB } = await setup()
    const reencryptor = new EncryptionReencryptor(repo, onB)
    const first = await reencryptor.run({ batchSize: 2, maxBatches: 1 })
    expect(first).toMatchObject({
      scanned: 2,
      rewrapped: 2,
      done: false,
      lastId: '2',
    })
    const rest = await reencryptor.run({ batchSize: 2, afterId: first.lastId })
    expect(rest).toMatchObject({ scanned: 5, rewrapped: 3, done: true })
  })

  it('does not overwrite a value changed since it was read', async () => {
    const { repo, dataSource, onB } = await setup(1)
    const replacement = await serviceFor('a').encrypt('changed')
    const original = dataSource.updateOne.bind(dataSource)
    jest
      .spyOn(dataSource, 'updateOne')
      .mockImplementationOnce(async (c, f, u, o) => {
        await original(c, { _id: '1' }, { $set: { secret: replacement } })
        return original(c, f, u, o)
      })
    const report = await new EncryptionReencryptor(repo, onB).run()
    expect(report.skipped).toBeGreaterThanOrEqual(1)
    expect((await stored(dataSource))[0].secret).toBe(replacement)
  })

  it('refuses a service without rewrap', () => {
    const repo = new Repo({ name: 'user', schema: new Schema({}) }) as Repo<any>
    expect(
      () =>
        new EncryptionReencryptor(repo, {
          encrypt: async (s) => s,
          decrypt: async (s) => s,
        })
    ).toThrow('does not support rewrap')
  })
})
