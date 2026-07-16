import DataSourceMongodb from 'data-source/mongodb'

function createMockSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
  }
}

function createMockCollection() {
  const collection: any = {
    insertOne: jest
      .fn()
      .mockResolvedValue({ insertedCount: 1, insertedId: 'x1' }),
    find: jest
      .fn()
      .mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    drop: jest.fn().mockResolvedValue(undefined),
    createIndex: jest.fn().mockResolvedValue(undefined),
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'invoice', seq: 3 }),
  }
  // withSession returns the same collection instance (spy-able call args prove which
  // session, if any, a given operation was scoped to)
  collection.withSession = jest.fn().mockReturnValue(collection)
  return collection
}

function buildDataSource() {
  const collection = createMockCollection()
  const startSession = jest.fn()
  const dataSource = new DataSourceMongodb({ url: '' })
  ;(dataSource as any).client = { startSession }
  ;(dataSource as any).db = {
    collection: jest.fn().mockReturnValue(collection),
  }
  return { dataSource, collection, startSession }
}

describe('DataSourceMongodb', () => {
  describe('bulkWrite', () => {
    it('passes ops through 1:1 to the native driver, forces ordered:true, and maps the result', async () => {
      const mockBulkWrite = jest.fn().mockResolvedValue({
        insertedCount: 1,
        matchedCount: 2,
        modifiedCount: 2,
        deletedCount: 1,
        upsertedCount: 0,
        insertedIds: { 0: 'abc' },
        upsertedIds: {},
      })
      const mockCollection = { bulkWrite: mockBulkWrite }
      const dataSource = new DataSourceMongodb({ url: '' })
      ;(dataSource as any).db = {
        collection: jest.fn().mockReturnValue(mockCollection),
      }

      const result = await dataSource.bulkWrite(
        'users',
        [
          { insertOne: { document: { name: 'John' } } },
          {
            updateMany: {
              filter: { active: true },
              update: { $set: { seen: true } },
            },
          },
          { deleteOne: { filter: { _id: '2' } } },
        ],
        { ordered: false }
      )

      expect(mockBulkWrite).toHaveBeenCalledTimes(1)
      const [driverOps, driverOptions] = mockBulkWrite.mock.calls[0]
      expect(driverOps).toEqual([
        { insertOne: { document: { name: 'John' } } },
        {
          updateMany: {
            filter: { active: true },
            update: { $set: { seen: true } },
          },
        },
        { deleteOne: { filter: { _id: '2' } } },
      ])
      // ordered:true is forced regardless of the caller passing ordered:false
      expect(driverOptions.ordered).toBe(true)

      expect(result).toEqual({
        insertedCount: 1,
        matchedCount: 2,
        modifiedCount: 2,
        deletedCount: 1,
        upsertedCount: 0,
        insertedIds: { 0: 'abc' },
        upsertedIds: {},
      })
    })
  })

  describe('getNextValue', () => {
    it('calls findOneAndUpdate with $inc/upsert/returnDocument and returns the new seq', async () => {
      const { dataSource, collection } = buildDataSource()

      const result = await dataSource.getNextValue('counters', 'invoice')

      expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'invoice' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      )
      expect(result).toBe(3)
    })

    it('unwraps a { value } result for callers passing includeResultMetadata: true', async () => {
      const { dataSource, collection } = buildDataSource()
      collection.findOneAndUpdate.mockResolvedValue({
        value: { _id: 'invoice', seq: 9 },
      })

      const result = await dataSource.getNextValue('counters', 'invoice', {
        includeResultMetadata: true,
      })

      expect(result).toBe(9)
    })
  })

  describe('transaction leases', () => {
    it('issues independent leases for concurrent transactionStart() calls', async () => {
      const { dataSource, startSession } = buildDataSource()
      const sessionA = createMockSession()
      const sessionB = createMockSession()
      startSession
        .mockResolvedValueOnce(sessionA)
        .mockResolvedValueOnce(sessionB)

      const leaseA = await dataSource.transactionStart()
      const leaseB = await dataSource.transactionStart()

      expect(leaseA).not.toBe(leaseB)
      expect(startSession).toHaveBeenCalledTimes(2)
      expect(sessionA.startTransaction).toHaveBeenCalledTimes(1)
      expect(sessionB.startTransaction).toHaveBeenCalledTimes(1)
      expect(dataSource.hasActiveLeases()).toBe(true)
    })

    it('never throws "already in progress" for concurrent transactionStart() calls', async () => {
      const { dataSource, startSession } = buildDataSource()
      startSession
        .mockResolvedValueOnce(createMockSession())
        .mockResolvedValueOnce(createMockSession())

      await dataSource.transactionStart()
      await expect(dataSource.transactionStart()).resolves.toBeDefined()
    })

    it('a plain find() concurrent with an open lease does not use the lease session', async () => {
      const { dataSource, startSession, collection } = buildDataSource()
      startSession.mockResolvedValueOnce(createMockSession())

      await dataSource.transactionStart()
      collection.withSession.mockClear()

      await dataSource.find('things')

      expect(collection.withSession).not.toHaveBeenCalled()
    })

    it('commit calls commitTransaction() + endSession() and clears the lease', async () => {
      const { dataSource, startSession } = buildDataSource()
      const session = createMockSession()
      startSession.mockResolvedValueOnce(session)

      const lease = await dataSource.transactionStart()
      await lease.transactionCommit()

      expect(session.commitTransaction).toHaveBeenCalledTimes(1)
      expect(session.endSession).toHaveBeenCalledTimes(1)
      expect(dataSource.hasActiveLeases()).toBe(false)
    })

    it('rollback calls abortTransaction() + endSession() and clears the lease', async () => {
      const { dataSource, startSession } = buildDataSource()
      const session = createMockSession()
      startSession.mockResolvedValueOnce(session)

      const lease = await dataSource.transactionStart()
      await lease.transactionRollback()

      expect(session.abortTransaction).toHaveBeenCalledTimes(1)
      expect(session.endSession).toHaveBeenCalledTimes(1)
      expect(dataSource.hasActiveLeases()).toBe(false)
    })

    it('throws the closed-lease message when used after commit', async () => {
      const { dataSource, startSession } = buildDataSource()
      startSession.mockResolvedValueOnce(createMockSession())

      const lease = await dataSource.transactionStart()
      await lease.transactionCommit()

      await expect(lease.find('things')).rejects.toThrow(
        'This transaction lease has already been committed or rolled back'
      )
    })

    it('throws the closed-lease message when used after rollback', async () => {
      const { dataSource, startSession } = buildDataSource()
      startSession.mockResolvedValueOnce(createMockSession())

      const lease = await dataSource.transactionStart()
      await lease.transactionRollback()

      await expect(lease.find('things')).rejects.toThrow(
        'This transaction lease has already been committed or rolled back'
      )
    })

    it('a CRUD method invoked through the lease scopes the query to the lease session', async () => {
      const { dataSource, startSession, collection } = buildDataSource()
      const session = createMockSession()
      startSession.mockResolvedValueOnce(session)

      const lease = await dataSource.transactionStart()
      await lease.insertOne('things', { _id: 't1' })

      expect(collection.withSession).toHaveBeenCalledWith(session)
    })

    it('the same CRUD method on the parent (no session) does not call withSession', async () => {
      const { dataSource, startSession, collection } = buildDataSource()
      startSession.mockResolvedValueOnce(createMockSession())

      await dataSource.transactionStart()
      collection.withSession.mockClear()

      await dataSource.insertOne('things', { _id: 't1' })

      expect(collection.withSession).not.toHaveBeenCalled()
    })

    it('getNextValue invoked through the lease scopes the call to the lease session', async () => {
      const { dataSource, startSession, collection } = buildDataSource()
      const session = createMockSession()
      startSession.mockResolvedValueOnce(session)

      const lease = await dataSource.transactionStart()
      const result = await lease.getNextValue('counters', 'invoice')

      expect(collection.withSession).toHaveBeenCalledWith(session)
      expect(result).toBe(3)
    })

    it('a DDL method invoked through the lease does not call withSession - DDL always escapes the transaction', async () => {
      const { dataSource, startSession, collection } = buildDataSource()
      startSession.mockResolvedValueOnce(createMockSession())

      const lease = await dataSource.transactionStart()
      collection.withSession.mockClear()

      await lease.drop('things')
      await lease.createIndex('things', { name: 1 })

      expect(collection.withSession).not.toHaveBeenCalled()
    })
  })
})
