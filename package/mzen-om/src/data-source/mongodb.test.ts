import DataSourceMongodb from 'data-source/mongodb'

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
})
