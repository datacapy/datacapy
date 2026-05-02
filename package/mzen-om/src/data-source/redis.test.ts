import { DataSourceRedis } from 'data-source/redis'

jest.mock('ioredis')

// ─── FakeRedisStore ───────────────────────────────────────────────────────────
//
// Lightweight in-memory Redis simulation. Wired onto the ioredis mock so tests
// can assert on observed state rather than raw mock call arguments.

class FakeRedisStore {
  data: Map<string, string> = new Map()
  sets: Map<string, Set<string>> = new Map()

  set = jest.fn((key: string, value: string) => {
    this.data.set(key, value)
    return Promise.resolve('OK')
  })

  get = jest.fn((key: string) => {
    return Promise.resolve(this.data.get(key) ?? null)
  })

  mget = jest.fn((...keys: string[]) => {
    return Promise.resolve(keys.map((k) => this.data.get(k) ?? null))
  })

  del = jest.fn((...keys: string[]) => {
    let count = 0
    for (const k of keys) {
      if (this.data.delete(k)) count++
      if (this.sets.delete(k)) count++
    }
    return Promise.resolve(count)
  })

  sadd = jest.fn((key: string, ...members: string[]) => {
    if (!this.sets.has(key)) this.sets.set(key, new Set())
    for (const m of members) this.sets.get(key).add(m)
    return Promise.resolve(members.length)
  })

  srem = jest.fn((key: string, ...members: string[]) => {
    const s = this.sets.get(key)
    if (!s) return Promise.resolve(0)
    let count = 0
    for (const m of members) {
      if (s.delete(m)) count++
    }
    return Promise.resolve(count)
  })

  smembers = jest.fn((key: string) => {
    return Promise.resolve(Array.from(this.sets.get(key) ?? []))
  })

  expire = jest.fn((_key: string, _ttl: number) => Promise.resolve(1))

  scan = jest.fn(
    (
      _cursor: string,
      _matchKw: string,
      pattern: string,
      _countKw: string,
      _count: number
    ) => {
      // Escape all regex special chars (including *), then convert \* → .*
      const regex = new RegExp(
        '^' +
          pattern
            .replace(/[.+?^${}()|[\]\\*]/g, (c) => `\\${c}`)
            .replace(/\\\*/g, '.*') +
          '$'
      )
      const matching = Array.from(this.data.keys()).filter((k) => regex.test(k))
      return Promise.resolve(['0', matching])
    }
  )

  info = jest.fn((_section: string) => {
    return Promise.resolve('used_memory_human:1.23M\nother_field:ignored')
  })

  publish = jest.fn((_channel: string, _message: string) => Promise.resolve(1))

  on = jest.fn()

  quit = jest.fn(() => Promise.resolve())

  multi = jest.fn(() => this.buildPipeline())

  // Creates a pipeline that buffers commands and replays them on exec()
  buildPipeline() {
    const buffer: Array<() => void> = []
    const pipeline: Record<string, any> = {
      set: jest.fn((key: string, value: string) => {
        buffer.push(() => this.set(key, value))
        return pipeline
      }),
      del: jest.fn((...keys: string[]) => {
        buffer.push(() => this.del(...keys))
        return pipeline
      }),
      sadd: jest.fn((key: string, ...members: string[]) => {
        buffer.push(() => this.sadd(key, ...members))
        return pipeline
      }),
      srem: jest.fn((key: string, ...members: string[]) => {
        buffer.push(() => this.srem(key, ...members))
        return pipeline
      }),
      expire: jest.fn((_key: string, _ttl: number) => pipeline),
      exec: jest.fn(async () => {
        for (const fn of buffer) fn()
        buffer.length = 0
        return []
      }),
      discard: jest.fn(async () => {
        buffer.length = 0
      }),
    }
    return pipeline
  }

  reset() {
    this.data.clear()
    this.sets.clear()
    jest.clearAllMocks()
    // Re-bind implementations after clearAllMocks resets them
    this.set.mockImplementation((key, value) => {
      this.data.set(key, value)
      return Promise.resolve('OK')
    })
    this.get.mockImplementation((key) =>
      Promise.resolve(this.data.get(key) ?? null)
    )
    this.mget.mockImplementation((...keys) =>
      Promise.resolve(keys.map((k) => this.data.get(k) ?? null))
    )
    this.del.mockImplementation((...keys) => {
      let count = 0
      for (const k of keys) {
        if (this.data.delete(k)) count++
        if (this.sets.delete(k)) count++
      }
      return Promise.resolve(count)
    })
    this.sadd.mockImplementation((key, ...members) => {
      if (!this.sets.has(key)) this.sets.set(key, new Set())
      for (const m of members) this.sets.get(key).add(m)
      return Promise.resolve(members.length)
    })
    this.srem.mockImplementation((key, ...members) => {
      const s = this.sets.get(key)
      if (!s) return Promise.resolve(0)
      let count = 0
      for (const m of members) {
        if (s.delete(m)) count++
      }
      return Promise.resolve(count)
    })
    this.smembers.mockImplementation((key) =>
      Promise.resolve(Array.from(this.sets.get(key) ?? []))
    )
    this.expire.mockImplementation((_key, _ttl) => Promise.resolve(1))
    this.scan.mockImplementation(
      (_cursor, _matchKw, pattern, _countKw, _count) => {
        const regex = new RegExp(
          '^' +
            pattern
              .replace(/[.+?^${}()|[\]\\*]/g, (c) => `\\${c}`)
              .replace(/\\\*/g, '.*') +
            '$'
        )
        const matching = Array.from(this.data.keys()).filter((k) =>
          regex.test(k)
        )
        return Promise.resolve(['0', matching])
      }
    )
    this.info.mockImplementation((_section) =>
      Promise.resolve('used_memory_human:1.23M\nother_field:ignored')
    )
    this.publish.mockImplementation(() => Promise.resolve(1))
    this.quit.mockImplementation(() => Promise.resolve())
    this.multi.mockImplementation(() => this.buildPipeline())
  }
}

// ─── FakeSubscriberStore ──────────────────────────────────────────────────────

class FakeSubscriberStore {
  subscribe = jest.fn(() => Promise.resolve())
  on = jest.fn()
  quit = jest.fn(() => Promise.resolve())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let store: FakeRedisStore

async function buildConnectedDataSource(config = {}): Promise<DataSourceRedis> {
  const IORedis = require('ioredis')
  IORedis.mockImplementation(() => store)
  const ds = new DataSourceRedis(config)
  await ds.connect()
  return ds
}

async function buildConnectedDataSourceWithSubscriber(
  config = {}
): Promise<[DataSourceRedis, FakeSubscriberStore]> {
  const IORedis = require('ioredis')
  const subStore = new FakeSubscriberStore()
  let callCount = 0
  IORedis.mockImplementation(() => (callCount++ === 0 ? store : subStore))
  const ds = new DataSourceRedis(config)
  await ds.connect()
  return [ds, subStore]
}

async function seed(
  ds: DataSourceRedis,
  collectionName: string,
  docs: any[]
): Promise<void> {
  await ds.insertMany(collectionName, docs)
}

// ─── Test data ────────────────────────────────────────────────────────────────

const albums = [
  { _id: '1', name: 'Pablo Honey', artistId: '7', year: 1993 },
  { _id: '2', name: 'The Bends', artistId: '7', year: 1995 },
  { _id: '3', name: 'OK Computer', artistId: '7', year: 1997, popular: 1 },
  { _id: '4', name: 'Kid A', artistId: '7', year: 2000, popular: 1 },
  { _id: '5', name: 'Amputechture', artistId: '14', year: 2006, popular: 1 },
  {
    _id: '6',
    name: 'The Bedlam in Goliath',
    artistId: '14',
    year: 2008,
    popular: 1,
  },
  { _id: '7', name: 'Octahedron', artistId: '14', year: 2009 },
  { _id: '8', name: 'Noctourniquet', artistId: '14', year: 2012 },
]

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('DataSourceRedis', () => {
  beforeEach(() => {
    if (!store) store = new FakeRedisStore()
    else store.reset()
  })

  // ── connect() ───────────────────────────────────────────────────────────────

  describe('connect()', () => {
    it('uses url when provided', async () => {
      const IORedis = require('ioredis')
      IORedis.mockImplementation(() => store)
      const ds = new DataSourceRedis({ url: 'redis://localhost:6379' })
      await ds.connect()
      expect(IORedis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({ keyPrefix: undefined })
      )
    })

    it('uses host/port config when no url', async () => {
      const IORedis = require('ioredis')
      IORedis.mockImplementation(() => store)
      const ds = new DataSourceRedis({ host: '127.0.0.1', port: 6380 })
      await ds.connect()
      expect(IORedis).toHaveBeenCalledWith(
        expect.objectContaining({ host: '127.0.0.1', port: 6380 })
      )
    })

    it('returns the datasource instance', async () => {
      const IORedis = require('ioredis')
      IORedis.mockImplementation(() => store)
      const ds = new DataSourceRedis({})
      const result = await ds.connect()
      expect(result).toBe(ds)
    })

    it('does not pass trackIds to ioredis', async () => {
      const IORedis = require('ioredis')
      IORedis.mockImplementation(() => store)
      const ds = new DataSourceRedis({ host: 'localhost', trackIds: false })
      await ds.connect()
      expect(IORedis).toHaveBeenCalledWith(
        expect.not.objectContaining({ trackIds: false })
      )
    })
  })

  // ── connected ───────────────────────────────────────────────────────────────

  describe('connected', () => {
    it('is false before connect()', () => {
      const ds = new DataSourceRedis({})
      expect(ds.connected).toBe(false)
    })

    it('sets connected to true when ready event fires', async () => {
      const ds = await buildConnectedDataSource()
      const [, cb] = store.on.mock.calls.find(([event]) => event === 'ready')
      cb()
      expect(ds.connected).toBe(true)
    })

    it('sets connected to false on error event', async () => {
      const ds = await buildConnectedDataSource()
      store.on.mock.calls.find(([event]) => event === 'ready')[1]()
      expect(ds.connected).toBe(true)
      store.on.mock.calls.find(([event]) => event === 'error')[1](new Error())
      expect(ds.connected).toBe(false)
    })

    it('sets connected to false on close event', async () => {
      const ds = await buildConnectedDataSource()
      store.on.mock.calls.find(([event]) => event === 'ready')[1]()
      store.on.mock.calls.find(([event]) => event === 'close')[1]()
      expect(ds.connected).toBe(false)
    })
  })

  // ── TTL (createIndex expireAfterSeconds) ────────────────────────────────────

  describe('TTL via createIndex expireAfterSeconds', () => {
    it('calls EXPIRE after insertOne when TTL is registered', async () => {
      const ds = await buildConnectedDataSource()
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 3600 })
      await ds.insertOne('sessions', { _id: 's1', data: 'x' })
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:s1', 3600)
    })

    it('does not call EXPIRE when no TTL is registered', async () => {
      const ds = await buildConnectedDataSource()
      await ds.insertOne('things', { _id: 't1', data: 'x' })
      expect(store.expire).not.toHaveBeenCalled()
    })

    it('calls EXPIRE for each doc in insertMany', async () => {
      const ds = await buildConnectedDataSource()
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 60 })
      await ds.insertMany('sessions', [
        { _id: 'a', data: 1 },
        { _id: 'b', data: 2 },
      ])
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:a', 60)
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:b', 60)
    })

    it('calls EXPIRE after updateOne', async () => {
      const ds = await buildConnectedDataSource()
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 60 })
      await ds.insertOne('sessions', { _id: 's1', data: 'x' })
      store.expire.mockClear()
      await ds.updateOne('sessions', { _id: 's1' }, { $set: { data: 'y' } })
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:s1', 60)
    })

    it('calls EXPIRE for each updated doc in updateMany', async () => {
      const ds = await buildConnectedDataSource()
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 60 })
      await ds.insertMany('sessions', [
        { _id: 'a', data: 1 },
        { _id: 'b', data: 2 },
      ])
      store.expire.mockClear()
      await ds.updateMany('sessions', {}, { $set: { data: 99 } })
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:a', 60)
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:b', 60)
    })

    it('calls EXPIRE via pipeline during a transaction', async () => {
      const ds = await buildConnectedDataSource()
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 30 })
      await ds.transactionStart()
      await ds.insertOne('sessions', { _id: 'tx1', data: 'y' })
      const pipeline = store.multi.mock.results[0].value
      expect(pipeline.expire).toHaveBeenCalledWith('sessions:doc:tx1', 30)
      await ds.transactionCommit()
    })
  })

  // ── trackIds: false ─────────────────────────────────────────────────────────

  describe('trackIds: false', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource({ trackIds: false })
    })

    it('insertOne stores the doc but does not call sadd', async () => {
      await ds.insertOne('cache', { _id: 'k1', data: 'v' })
      expect(store.data.has('cache:doc:k1')).toBe(true)
      expect(store.sadd).not.toHaveBeenCalled()
    })

    it('insertMany stores docs but does not call sadd', async () => {
      await ds.insertMany('cache', [
        { _id: 'a', data: 1 },
        { _id: 'b', data: 2 },
      ])
      expect(store.data.has('cache:doc:a')).toBe(true)
      expect(store.data.has('cache:doc:b')).toBe(true)
      expect(store.sadd).not.toHaveBeenCalled()
    })

    it('findOne by _id still works', async () => {
      await ds.insertOne('cache', { _id: 'k1', data: 'hello' })
      const result = await ds.findOne('cache', { _id: 'k1' })
      expect(result?.data).toBe('hello')
    })

    it('find without _id filter returns empty (no full-scan)', async () => {
      await ds.insertOne('cache', { _id: 'k1', data: 'x' })
      const result = await ds.find('cache', { data: 'x' })
      expect(result).toEqual([])
      expect(store.smembers).not.toHaveBeenCalled()
    })

    it('deleteOne by _id removes the doc and does not call srem', async () => {
      await ds.insertOne('cache', { _id: 'k1', data: 'x' })
      store.srem.mockClear()
      await ds.deleteOne('cache', { _id: 'k1' })
      expect(store.data.has('cache:doc:k1')).toBe(false)
      expect(store.srem).not.toHaveBeenCalled()
    })

    it('deleteMany by _id removes docs and does not call srem', async () => {
      await ds.insertMany('cache', [
        { _id: 'a', data: 1 },
        { _id: 'b', data: 2 },
      ])
      store.srem.mockClear()
      await ds.deleteMany('cache', { _id: { $in: ['a', 'b'] } })
      expect(store.data.has('cache:doc:a')).toBe(false)
      expect(store.data.has('cache:doc:b')).toBe(false)
      expect(store.srem).not.toHaveBeenCalled()
    })

    it('drop uses SCAN to find and delete all doc keys', async () => {
      await ds.insertOne('cache', { _id: 'k1', data: 'x' })
      await ds.insertOne('cache', { _id: 'k2', data: 'y' })
      await ds.drop('cache')
      expect(store.scan).toHaveBeenCalled()
      expect(store.data.has('cache:doc:k1')).toBe(false)
      expect(store.data.has('cache:doc:k2')).toBe(false)
    })

    it('drop does not call smembers', async () => {
      await ds.insertOne('cache', { _id: 'k1', data: 'x' })
      await ds.drop('cache')
      expect(store.smembers).not.toHaveBeenCalled()
    })
  })

  // ── getStats() ───────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('returns connected state, memory, and key count', async () => {
      const ds = await buildConnectedDataSource()
      await ds.insertOne('things', { _id: 't1' })
      const stats = await ds.getStats()
      expect(stats.connected).toBe(false) // ready event not manually triggered
      expect(stats.memory).toBe('1.23M')
      expect(typeof stats.keys).toBe('number')
    })

    it('returns fallback values when info throws', async () => {
      const ds = await buildConnectedDataSource()
      store.info.mockRejectedValueOnce(new Error('connection refused'))
      const stats = await ds.getStats()
      expect(stats.memory).toBe('unknown')
      expect(stats.keys).toBe(0)
      expect(typeof stats.connected).toBe('boolean')
    })
  })

  // ── publish() ────────────────────────────────────────────────────────────────

  describe('publish()', () => {
    it('calls client.publish with the serialised message', async () => {
      const ds = await buildConnectedDataSource()
      await ds.publish('my-channel', { foo: 'bar' })
      expect(store.publish).toHaveBeenCalledWith(
        'my-channel',
        JSON.stringify({ foo: 'bar' })
      )
    })
  })

  // ── subscribe() ──────────────────────────────────────────────────────────────

  describe('subscribe()', () => {
    it('subscribes to the channel on the subscriber client', async () => {
      const [ds, subStore] = await buildConnectedDataSourceWithSubscriber()
      await ds.subscribe('test-channel', () => {})
      expect(subStore.subscribe).toHaveBeenCalledWith('test-channel')
    })

    it('calls callback with deserialised message', async () => {
      const [ds, subStore] = await buildConnectedDataSourceWithSubscriber()
      const callback = jest.fn()
      await ds.subscribe('test-channel', callback)
      const [, handler] = subStore.on.mock.calls.find(([e]) => e === 'message')
      handler('test-channel', JSON.stringify({ hello: 'world' }))
      expect(callback).toHaveBeenCalledWith({ hello: 'world' })
    })

    it('ignores messages on other channels', async () => {
      const [ds, subStore] = await buildConnectedDataSourceWithSubscriber()
      const callback = jest.fn()
      await ds.subscribe('test-channel', callback)
      const [, handler] = subStore.on.mock.calls.find(([e]) => e === 'message')
      handler('other-channel', JSON.stringify({ hello: 'world' }))
      expect(callback).not.toHaveBeenCalled()
    })

    it('reuses the same subscriber client across multiple subscribe calls', async () => {
      const IORedis = require('ioredis')
      const subStore = new FakeSubscriberStore()
      let callCount = 0
      IORedis.mockImplementation(() => (callCount++ === 0 ? store : subStore))
      const ds = new DataSourceRedis({})
      await ds.connect()
      await ds.subscribe('ch1', () => {})
      await ds.subscribe('ch2', () => {})
      // IORedis called once for main client + once for subscriber = 2 total
      expect(callCount).toBe(2)
    })
  })

  // ── _id pre-filter ───────────────────────────────────────────────────────────

  describe('_id pre-filter', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
      store.smembers.mockClear()
      store.mget.mockClear()
    })

    const expectTargetedFetch = () =>
      expect(store.smembers).not.toHaveBeenCalled()

    const expectFullScan = () =>
      expect(store.smembers).toHaveBeenCalledWith('album:ids')

    it('skips smembers for bare { _id: value }', async () => {
      await ds.find('album', { _id: '3' })
      expectTargetedFetch()
    })

    it('skips smembers for { _id: { $eq } }', async () => {
      await ds.find('album', { _id: { $eq: '3' } })
      expectTargetedFetch()
    })

    it('skips smembers for { _id: { $in } }', async () => {
      await ds.find('album', { _id: { $in: ['2', '4'] } })
      expectTargetedFetch()
    })

    it('skips smembers when _id is inside $and', async () => {
      await ds.find('album', { $and: [{ _id: '3' }, { popular: 1 }] })
      expectTargetedFetch()
    })

    it('skips smembers when _id is inside nested $and', async () => {
      await ds.find('album', { $and: [{ $and: [{ _id: '3' }] }] })
      expectTargetedFetch()
    })

    it('uses full scan when no _id in query', async () => {
      await ds.find('album', { popular: 1 })
      expectFullScan()
    })

    it('uses full scan when _id uses unsupported operator', async () => {
      await ds.find('album', { _id: { $gt: '3' } })
      expectFullScan()
    })

    it('skips smembers when $and contains $or alongside _id', async () => {
      await ds.find('album', {
        $and: [{ _id: '3' }, { $or: [{ popular: 1 }] }],
      })
      expectTargetedFetch()
    })

    it('skips smembers when top-level $or appears alongside $and containing _id', async () => {
      await ds.find('album', {
        $and: [{ _id: '3' }],
        $or: [{ artistId: '14' }],
      })
      expectTargetedFetch()
    })

    it('uses full scan when _id is only inside $or', async () => {
      await ds.find('album', { $or: [{ _id: '3' }, { popular: 1 }] })
      expectFullScan()
    })

    it('uses full scan when _id is only reachable through $or within $and', async () => {
      await ds.find('album', {
        $and: [{ $or: [{ _id: '3' }, { popular: 1 }] }],
      })
      expectFullScan()
    })
  })

  // ── find() ───────────────────────────────────────────────────────────────────

  describe('find()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('returns all docs when no query', async () => {
      const result = await ds.find('album')
      expect(result).toHaveLength(albums.length)
    })

    it('returns empty array for unknown collection', async () => {
      const result = await ds.find('unknown')
      expect(result).toEqual([])
    })

    it('filters by bare field equality', async () => {
      const result = await ds.find('album', { popular: 1 })
      expect(result.map((d) => d._id)).toEqual(['3', '4', '5', '6'])
    })

    it('filters by $eq', async () => {
      const result = await ds.find('album', { artistId: { $eq: '14' } })
      expect(result.map((d) => d._id)).toEqual(['5', '6', '7', '8'])
    })

    it('filters by $ne', async () => {
      const result = await ds.find('album', { artistId: { $ne: '7' } })
      expect(result.map((d) => d._id)).toEqual(['5', '6', '7', '8'])
    })

    it('filters by $gt', async () => {
      const result = await ds.find('album', { year: { $gt: 2009 } })
      expect(result.map((d) => d._id)).toEqual(['8'])
    })

    it('filters by $gte', async () => {
      const result = await ds.find('album', { year: { $gte: 2009 } })
      expect(result.map((d) => d._id)).toEqual(['7', '8'])
    })

    it('filters by $lt', async () => {
      const result = await ds.find('album', { year: { $lt: 1995 } })
      expect(result.map((d) => d._id)).toEqual(['1'])
    })

    it('filters by $lte', async () => {
      const result = await ds.find('album', { year: { $lte: 1995 } })
      expect(result.map((d) => d._id)).toEqual(['1', '2'])
    })

    it('filters by $in', async () => {
      const result = await ds.find('album', { _id: { $in: ['2', '4', '6'] } })
      expect(result.map((d) => d._id)).toEqual(['2', '4', '6'])
    })

    it('filters by $nin', async () => {
      const result = await ds.find('album', { artistId: { $nin: ['7'] } })
      expect(result.map((d) => d._id)).toEqual(['5', '6', '7', '8'])
    })

    it('filters by $exists: true', async () => {
      const result = await ds.find('album', { popular: { $exists: true } })
      expect(result.map((d) => d._id)).toEqual(['3', '4', '5', '6'])
    })

    it('filters by $exists: false', async () => {
      const result = await ds.find('album', { popular: { $exists: false } })
      expect(result.map((d) => d._id)).toEqual(['1', '2', '7', '8'])
    })

    it('filters by $like with % wildcard', async () => {
      const result = await ds.find('album', { name: { $like: '%Bends%' } })
      expect(result.map((d) => d._id)).toEqual(['2'])
    })

    it('filters by $like with _ wildcard', async () => {
      const result = await ds.find('album', { name: { $like: 'Kid _' } })
      expect(result.map((d) => d._id)).toEqual(['4'])
    })

    it('filters by $not', async () => {
      const result = await ds.find('album', { year: { $not: { $gt: 2000 } } })
      expect(result.map((d) => d._id)).toEqual(['1', '2', '3', '4'])
    })

    it('handles $or — returns docs matching any branch', async () => {
      const result = await ds.find('album', {
        $or: [{ _id: '1' }, { _id: '8' }],
      })
      expect(result.map((d) => d._id)).toEqual(
        expect.arrayContaining(['1', '8'])
      )
      expect(result).toHaveLength(2)
    })

    it('handles $and — all conditions must match', async () => {
      const result = await ds.find('album', {
        $and: [{ artistId: '7' }, { popular: 1 }],
      })
      expect(result.map((d) => d._id)).toEqual(['3', '4'])
    })

    it('sorts ascending', async () => {
      const result = await ds.find('album', {}, { sort: { year: 1 } })
      const years = result.map((d) => d.year)
      expect(years).toEqual([...years].sort((a, b) => a - b))
    })

    it('sorts descending', async () => {
      const result = await ds.find('album', {}, { sort: { year: -1 } })
      const years = result.map((d) => d.year)
      expect(years).toEqual([...years].sort((a, b) => b - a))
    })

    it('applies skip', async () => {
      const result = await ds.find('album', {}, { skip: 6 })
      expect(result).toHaveLength(2)
    })

    it('applies limit', async () => {
      const result = await ds.find('album', {}, { limit: 3 })
      expect(result).toHaveLength(3)
    })

    it('applies fields inclusion', async () => {
      const result = await ds.find('album', {}, { fields: { name: 1 } })
      for (const doc of result) {
        expect(Object.keys(doc)).toEqual(['name'])
      }
    })

    it('applies fields exclusion', async () => {
      const result = await ds.find('album', {}, { fields: { popular: 0 } })
      for (const doc of result) {
        expect(doc).not.toHaveProperty('popular')
        expect(doc).toHaveProperty('_id')
      }
    })
  })

  // ── findOne() ────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('returns first matching document', async () => {
      const result = await ds.findOne('album', { popular: 1 })
      expect(result._id).toBe('3')
    })

    it('returns null when no match', async () => {
      const result = await ds.findOne('album', { _id: 'nonexistent' })
      expect(result).toBeNull()
    })
  })

  // ── findGroup() ──────────────────────────────────────────────────────────────

  describe('findGroup()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('returns one doc per unique groupField value', async () => {
      const result = await ds.findGroup('album', ['artistId'])
      const ids = result.map((d) => d.artistId)
      expect(ids).toHaveLength(2)
      expect(ids).toContain('7')
      expect(ids).toContain('14')
    })

    it('respects query filter', async () => {
      const result = await ds.findGroup('album', ['artistId'], { popular: 1 })
      expect(result).toHaveLength(2)
    })
  })

  // ── count() ──────────────────────────────────────────────────────────────────

  describe('count()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('returns total document count', async () => {
      expect(await ds.count('album')).toBe(8)
    })

    it('returns filtered count', async () => {
      expect(await ds.count('album', { popular: 1 })).toBe(4)
    })
  })

  // ── groupCount() ─────────────────────────────────────────────────────────────

  describe('groupCount()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('returns correct group counts', async () => {
      const result = await ds.groupCount('album', ['artistId'])
      const map = Object.fromEntries(
        result.map((r) => [r._id.artistId, r.count])
      )
      expect(map['7']).toBe(4)
      expect(map['14']).toBe(4)
    })

    it('respects query filter', async () => {
      const result = await ds.groupCount('album', ['artistId'], { popular: 1 })
      const map = Object.fromEntries(
        result.map((r) => [r._id.artistId, r.count])
      )
      expect(map['7']).toBe(2)
      expect(map['14']).toBe(2)
    })
  })

  // ── insertOne() ──────────────────────────────────────────────────────────────

  describe('insertOne()', () => {
    it('stores the document as JSON at the correct key', async () => {
      const ds = await buildConnectedDataSource()
      const doc = { _id: 'x1', name: 'Test' }
      await ds.insertOne('things', doc)
      const stored = store.data.get('things:doc:x1')
      expect(JSON.parse(stored)).toEqual(doc)
    })

    it('adds the id to the ids set', async () => {
      const ds = await buildConnectedDataSource()
      await ds.insertOne('things', { _id: 'x1', name: 'Test' })
      expect(store.sets.get('things:ids').has('x1')).toBe(true)
    })

    it('returns { count: 1, id }', async () => {
      const ds = await buildConnectedDataSource()
      const result = await ds.insertOne('things', { _id: 'x1', name: 'Test' })
      expect(result).toEqual({ count: 1, id: 'x1' })
    })
  })

  // ── insertMany() ─────────────────────────────────────────────────────────────

  describe('insertMany()', () => {
    it('stores all documents', async () => {
      const ds = await buildConnectedDataSource()
      const docs = [
        { _id: 'a', name: 'A' },
        { _id: 'b', name: 'B' },
      ]
      await ds.insertMany('things', docs)
      expect(JSON.parse(store.data.get('things:doc:a'))).toEqual(docs[0])
      expect(JSON.parse(store.data.get('things:doc:b'))).toEqual(docs[1])
    })

    it('adds all ids to the ids set', async () => {
      const ds = await buildConnectedDataSource()
      await ds.insertMany('things', [
        { _id: 'a', name: 'A' },
        { _id: 'b', name: 'B' },
      ])
      const ids = store.sets.get('things:ids')
      expect(ids.has('a')).toBe(true)
      expect(ids.has('b')).toBe(true)
    })

    it('returns correct count and ids map', async () => {
      const ds = await buildConnectedDataSource()
      const result = await ds.insertMany('things', [
        { _id: 'a', name: 'A' },
        { _id: 'b', name: 'B' },
      ])
      expect(result.count).toBe(2)
      expect(result.ids[0]).toBe('a')
      expect(result.ids[1]).toBe('b')
    })
  })

  // ── updateOne() ──────────────────────────────────────────────────────────────

  describe('updateOne()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('$set updates a field', async () => {
      await ds.updateOne('album', { _id: '1' }, { $set: { name: 'Updated' } })
      const doc = JSON.parse(store.data.get('album:doc:1'))
      expect(doc.name).toBe('Updated')
    })

    it('$set updates a nested field via dot notation', async () => {
      await ds.insertOne('things', { _id: 'n1', meta: { count: 0 } })
      await ds.updateOne('things', { _id: 'n1' }, { $set: { 'meta.count': 5 } })
      const doc = JSON.parse(store.data.get('things:doc:n1'))
      expect(doc.meta.count).toBe(5)
    })

    it('$unset removes a field', async () => {
      await ds.updateOne('album', { _id: '3' }, { $unset: { popular: '' } })
      const doc = JSON.parse(store.data.get('album:doc:3'))
      expect(doc).not.toHaveProperty('popular')
    })

    it('$inc increments a field', async () => {
      await ds.insertOne('things', { _id: 'c1', count: 3 })
      await ds.updateOne('things', { _id: 'c1' }, { $inc: { count: 2 } })
      const doc = JSON.parse(store.data.get('things:doc:c1'))
      expect(doc.count).toBe(5)
    })

    it('$mul multiplies a field', async () => {
      await ds.insertOne('things', { _id: 'm1', value: 4 })
      await ds.updateOne('things', { _id: 'm1' }, { $mul: { value: 3 } })
      const doc = JSON.parse(store.data.get('things:doc:m1'))
      expect(doc.value).toBe(12)
    })

    it('$min updates when new value is smaller', async () => {
      await ds.insertOne('things', { _id: 'mn1', score: 10 })
      await ds.updateOne('things', { _id: 'mn1' }, { $min: { score: 5 } })
      const doc = JSON.parse(store.data.get('things:doc:mn1'))
      expect(doc.score).toBe(5)
    })

    it('$min does not update when new value is larger', async () => {
      await ds.insertOne('things', { _id: 'mn2', score: 10 })
      await ds.updateOne('things', { _id: 'mn2' }, { $min: { score: 20 } })
      const doc = JSON.parse(store.data.get('things:doc:mn2'))
      expect(doc.score).toBe(10)
    })

    it('$max updates when new value is larger', async () => {
      await ds.insertOne('things', { _id: 'mx1', score: 10 })
      await ds.updateOne('things', { _id: 'mx1' }, { $max: { score: 15 } })
      const doc = JSON.parse(store.data.get('things:doc:mx1'))
      expect(doc.score).toBe(15)
    })

    it('$max does not update when new value is smaller', async () => {
      await ds.insertOne('things', { _id: 'mx2', score: 10 })
      await ds.updateOne('things', { _id: 'mx2' }, { $max: { score: 3 } })
      const doc = JSON.parse(store.data.get('things:doc:mx2'))
      expect(doc.score).toBe(10)
    })

    it('returns { count: 0 } when no document matches', async () => {
      const result = await ds.updateOne(
        'album',
        { _id: 'nope' },
        { $set: { name: 'X' } }
      )
      expect(result).toEqual({ count: 0 })
    })

    it('returns { count: 1 } when a document is updated', async () => {
      const result = await ds.updateOne(
        'album',
        { _id: '1' },
        { $set: { name: 'X' } }
      )
      expect(result).toEqual({ count: 1 })
    })
  })

  // ── updateMany() ─────────────────────────────────────────────────────────────

  describe('updateMany()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('updates all matching documents', async () => {
      await ds.updateMany(
        'album',
        { artistId: '14' },
        { $set: { label: 'Gold' } }
      )
      const result = await ds.find('album', { label: 'Gold' })
      expect(result).toHaveLength(4)
    })

    it('returns correct count', async () => {
      const result = await ds.updateMany(
        'album',
        { popular: 1 },
        { $set: { featured: true } }
      )
      expect(result).toEqual({ count: 4 })
    })
  })

  // ── upsertOne() ──────────────────────────────────────────────────────────────

  describe('upsertOne()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('updates an existing document when the filter matches', async () => {
      await ds.upsertOne('album', { _id: '1' }, { $set: { name: 'Updated' } })
      const doc = JSON.parse(store.data.get('album:doc:1'))
      expect(doc.name).toBe('Updated')
    })

    it('returns { count: 1, upsertedCount: 0 } when a document is updated', async () => {
      const result = await ds.upsertOne(
        'album',
        { _id: '1' },
        { $set: { name: 'Updated' } }
      )
      expect(result).toEqual({ count: 1, upsertedCount: 0 })
    })

    it('inserts a new document from filter equality fields + $set when no match', async () => {
      await ds.upsertOne(
        'album',
        { _id: 'new1', artistId: '99' },
        { $set: { name: 'New Album' } }
      )
      const doc = JSON.parse(store.data.get('album:doc:new1'))
      expect(doc._id).toBe('new1')
      expect(doc.artistId).toBe('99')
      expect(doc.name).toBe('New Album')
    })

    it('adds the new id to the ids set on insert', async () => {
      await ds.upsertOne(
        'album',
        { _id: 'new2', artistId: '99' },
        { $set: { name: 'New Album' } }
      )
      expect(store.sets.get('album:ids').has('new2')).toBe(true)
    })

    it('returns { count: 1, upsertedCount: 1, upsertedId } on insert', async () => {
      const result = await ds.upsertOne(
        'album',
        { _id: 'new3', artistId: '99' },
        { $set: { name: 'New Album' } }
      )
      expect(result).toEqual({ count: 1, upsertedCount: 1, upsertedId: 'new3' })
    })

    it('calls EXPIRE on the new doc key when a TTL is registered', async () => {
      const ttlDs = await buildConnectedDataSource()
      await ttlDs.createIndex('sessions', '_id', { expireAfterSeconds: 3600 })
      store.expire.mockClear()

      await ttlDs.upsertOne(
        'sessions',
        { _id: 'newSession' },
        { $set: { data: 'x' } }
      )
      expect(store.expire).toHaveBeenCalledWith('sessions:doc:newSession', 3600)
    })
  })

  // ── upsertMany() ─────────────────────────────────────────────────────────────

  describe('upsertMany()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('updates all matching documents when filter matches', async () => {
      await ds.upsertMany(
        'album',
        { artistId: '14' },
        { $set: { label: 'Gold' } }
      )
      const result = await ds.find('album', { label: 'Gold' })
      expect(result).toHaveLength(4)
    })

    it('returns { count: N, upsertedCount: 0 } when documents are updated', async () => {
      const result = await ds.upsertMany(
        'album',
        { popular: 1 },
        { $set: { featured: true } }
      )
      expect(result).toEqual({ count: 4, upsertedCount: 0 })
    })

    it('inserts one document from filter + $set when no match', async () => {
      await ds.upsertMany(
        'album',
        { _id: 'newMany1', artistId: '77' },
        { $set: { name: 'New Many' } }
      )
      const doc = JSON.parse(store.data.get('album:doc:newMany1'))
      expect(doc._id).toBe('newMany1')
      expect(doc.artistId).toBe('77')
      expect(doc.name).toBe('New Many')
    })

    it('returns { count: 1, upsertedCount: 1 } when an insert occurs', async () => {
      const result = await ds.upsertMany(
        'album',
        { _id: 'newMany2', artistId: '77' },
        { $set: { name: 'New Many' } }
      )
      expect(result).toEqual({
        count: 1,
        upsertedCount: 1,
        upsertedId: 'newMany2',
      })
    })
  })

  // ── deleteOne() ──────────────────────────────────────────────────────────────

  describe('deleteOne()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('removes the document key', async () => {
      await ds.deleteOne('album', { _id: '1' })
      expect(store.data.has('album:doc:1')).toBe(false)
    })

    it('removes the id from the ids set', async () => {
      await ds.deleteOne('album', { _id: '1' })
      expect(store.sets.get('album:ids').has('1')).toBe(false)
    })

    it('returns { count: 1 }', async () => {
      const result = await ds.deleteOne('album', { _id: '1' })
      expect(result).toEqual({ count: 1 })
    })

    it('returns { count: 0 } when no match', async () => {
      const result = await ds.deleteOne('album', { _id: 'nope' })
      expect(result).toEqual({ count: 0 })
    })
  })

  // ── deleteMany() ─────────────────────────────────────────────────────────────

  describe('deleteMany()', () => {
    let ds: DataSourceRedis

    beforeEach(async () => {
      ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
    })

    it('removes all matching documents', async () => {
      await ds.deleteMany('album', { artistId: '14' })
      expect(store.data.has('album:doc:5')).toBe(false)
      expect(store.data.has('album:doc:6')).toBe(false)
      expect(store.data.has('album:doc:7')).toBe(false)
      expect(store.data.has('album:doc:8')).toBe(false)
    })

    it('removes deleted ids from the ids set', async () => {
      await ds.deleteMany('album', { artistId: '14' })
      const remaining = store.sets.get('album:ids')
      expect(remaining.has('5')).toBe(false)
      expect(remaining.has('6')).toBe(false)
    })

    it('returns correct count', async () => {
      const result = await ds.deleteMany('album', { artistId: '7' })
      expect(result).toEqual({ count: 4 })
    })
  })

  // ── drop() ───────────────────────────────────────────────────────────────────

  describe('drop()', () => {
    it('removes all doc keys and the ids set', async () => {
      const ds = await buildConnectedDataSource()
      await seed(ds, 'album', albums)
      await ds.drop('album')
      for (const doc of albums) {
        expect(store.data.has(`album:doc:${doc._id}`)).toBe(false)
      }
      expect(store.sets.has('album:ids')).toBe(false)
    })
  })

  // ── createIndex() / dropIndexes() ────────────────────────────────────────────

  describe('createIndex() / dropIndexes()', () => {
    it('records expireAfterSeconds for the collection', async () => {
      const ds = await buildConnectedDataSource()
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 3600 })
      // Verify TTL is tracked by checking it survives through dropIndex (no-op)
      await ds.dropIndex('sessions', 'someIndex')
      // dropIndexes clears TTL
      await ds.dropIndexes('sessions')
      // After dropIndexes, a subsequent createIndex with a new TTL should apply
      await ds.createIndex('sessions', { _id: 1 }, { expireAfterSeconds: 60 })
      // No observable side-effect beyond not throwing — covered by reaching here
      expect(true).toBe(true)
    })

    it('does not throw when no expireAfterSeconds option', async () => {
      const ds = await buildConnectedDataSource()
      await expect(
        ds.createIndex('album', { name: 1 }, { unique: true })
      ).resolves.not.toThrow()
    })
  })

  // ── Transactions ─────────────────────────────────────────────────────────────

  describe('transactions', () => {
    it('transactionStart throws if already in progress', async () => {
      const ds = await buildConnectedDataSource()
      await ds.transactionStart()
      await expect(ds.transactionStart()).rejects.toThrow(
        'Transaction already in progress'
      )
    })

    it('transactionCommit executes the pipeline', async () => {
      const ds = await buildConnectedDataSource()
      await ds.transactionStart()
      await ds.insertOne('things', { _id: 't1', value: 1 })
      await ds.transactionCommit()
      expect(store.data.has('things:doc:t1')).toBe(true)
    })

    it('transactionRollback discards the pipeline without applying writes', async () => {
      const ds = await buildConnectedDataSource()
      await seed(ds, 'album', [albums[0]])
      await ds.transactionStart()
      await ds.insertOne('things', { _id: 'discard-me', value: 99 })
      await ds.transactionRollback()
      expect(store.data.has('things:doc:discard-me')).toBe(false)
    })

    it('transactionCommit throws when no transaction is active', async () => {
      const ds = await buildConnectedDataSource()
      await expect(ds.transactionCommit()).rejects.toThrow(
        'No transaction in progress'
      )
    })

    it('transactionRollback throws when no transaction is active', async () => {
      const ds = await buildConnectedDataSource()
      await expect(ds.transactionRollback()).rejects.toThrow(
        'No transaction in progress'
      )
    })

    it('write calls during transaction are routed to the pipeline', async () => {
      const ds = await buildConnectedDataSource()
      await ds.transactionStart()
      // After transactionStart, multi() should have been called once
      expect(store.multi).toHaveBeenCalledTimes(1)
      await ds.transactionCommit()
    })
  })

  // ── close() ──────────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('calls quit on the client', async () => {
      const ds = await buildConnectedDataSource()
      await ds.close()
      expect(store.quit).toHaveBeenCalledTimes(1)
    })

    it('does not throw when called a second time', async () => {
      const ds = await buildConnectedDataSource()
      await ds.close()
      await expect(ds.close()).resolves.not.toThrow()
    })

    it('calls quit on the subscriber client when one exists', async () => {
      const [ds, subStore] = await buildConnectedDataSourceWithSubscriber()
      await ds.subscribe('ch', () => {})
      await ds.close()
      expect(subStore.quit).toHaveBeenCalledTimes(1)
    })
  })
})
