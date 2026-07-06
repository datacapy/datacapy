import DataSourceMock from 'data-source/mock'

const data = {
  recordCompany: [
    { _id: '63', name: 'EMI' },
    { _id: '89', name: 'Warner Bros.' },
  ],
  artist: [
    { _id: '7', name: 'Radiohead', recordCompanyId: '63' },
    { _id: '14', name: 'The Mars Volta', recordCompanyId: '89' },
  ],
  album: [
    { _id: '1', name: 'Pablo Honey', artistId: '7' },
    { _id: '2', name: 'The Bends', artistId: '7' },
    { _id: '3', name: 'OK Computer', artistId: '7', popular: 1 },
    { _id: '4', name: 'Kid A', artistId: '7', popular: 1 },
    { _id: '5', name: 'Amputechture', artistId: '14', popular: 1 },
    { _id: '6', name: 'The Bedlam in Goliath', artistId: '14', popular: 1 },
    { _id: '7', name: 'Octahedron', artistId: '14' },
    { _id: '8', name: 'Noctourniquet', artistId: '14' },
  ],
}

describe('Data Source', () => {
  describe('Mock', () => {
    describe('find()', () => {
      it('should return collection data array', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.find('album')
        expect(result).toEqual(data.album)
      })

      it('should filter collection data', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.find('album', { popular: 1 })
        expect(result).toEqual([
          data.album[2],
          data.album[3],
          data.album[4],
          data.album[5],
        ])
      })

      it('should filter collection data using $in', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.find('album', {
          _id: { $in: ['2', '4', '6'] },
        })
        expect(result).toEqual([data.album[1], data.album[3], data.album[5]])
      })
    })

    describe('findOne()', () => {
      it('should return collection data', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.findOne('album')
        expect(result).toEqual(data.album[0])
      })

      it('should filter collection data', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.findOne('album', { popular: 1 })
        expect(result).toEqual(data.album[2])
      })
    })

    describe('count()', () => {
      it('should count collection data', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.count('album')
        expect(result).toBe(8)
      })

      it('should count filtered collection data', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.count('album', { popular: 1 })
        expect(result).toBe(4)
      })
    })

    describe('bulkWrite()', () => {
      it('should accumulate counters/ids across a mixed op array', async () => {
        const datasource = new DataSourceMock(data)
        const result = await datasource.bulkWrite('album', [
          { insertOne: { document: { _id: '9', name: 'A Moon Shaped Pool' } } },
          {
            updateOne: {
              filter: { _id: '1' },
              update: { $set: { popular: 1 } },
            },
          },
          { deleteOne: { filter: { _id: '2' } } },
        ])

        expect(result).toEqual({
          insertedCount: 1,
          matchedCount: 1,
          modifiedCount: 1,
          deletedCount: 1,
          upsertedCount: 0,
          insertedIds: { 0: '9' },
          upsertedIds: {},
        })
        expect(datasource.dataInsert).toEqual([
          { _id: '9', name: 'A Moon Shaped Pool' },
        ])
      })

      it('should stop at the first op that throws', async () => {
        const datasource = new DataSourceMock(data)
        jest
          .spyOn(datasource, 'updateOne')
          .mockRejectedValueOnce(new Error('update failed'))
        const deleteOneSpy = jest.spyOn(datasource, 'deleteOne')

        await expect(
          datasource.bulkWrite('album', [
            {
              updateOne: {
                filter: { _id: '1' },
                update: { $set: { popular: 1 } },
              },
            },
            { deleteOne: { filter: { _id: '2' } } },
          ])
        ).rejects.toThrow('update failed')

        expect(deleteOneSpy).not.toHaveBeenCalled()
      })
    })
  })
})
