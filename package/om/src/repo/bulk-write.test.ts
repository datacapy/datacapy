import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('bulkWrite()', () => {
  it('should delegate to the datasource with the resolved collection name and prepared ops', async () => {
    const dataSource = new MockDataSource({})
    const bulkWriteSpy = jest.spyOn(dataSource, 'bulkWrite')

    const user = new Repo({
      name: 'user',
      collectionName: 'users',
      schema: {
        name: String,
      },
    })
    user.dataSource = dataSource

    await user.bulkWrite([
      { insertOne: { document: { name: 'Kevin' } } },
      {
        updateOne: { filter: { _id: '1' }, update: { $set: { name: 'Bob' } } },
      },
      { deleteOne: { filter: { _id: '2' } } },
    ])

    expect(bulkWriteSpy).toHaveBeenCalledTimes(1)
    const [collectionName, preparedOps] = bulkWriteSpy.mock.calls[0]
    expect(collectionName).toBe('users')
    expect(preparedOps).toHaveLength(3)
    expect(preparedOps[0]).toMatchObject({
      insertOne: { document: { name: 'Kevin' } },
    })
  })

  it('should stop before dispatching to the datasource when an op fails validation', async () => {
    const dataSource = new MockDataSource({})
    const bulkWriteSpy = jest.spyOn(dataSource, 'bulkWrite')

    const user = new Repo({
      name: 'user',
      collectionName: 'users',
      schema: {
        name: { $type: String, $validate: { required: true } },
      },
    })
    user.dataSource = dataSource

    await expect(
      user.bulkWrite([
        { insertOne: { document: { name: 'Kevin' } } },
        { insertOne: { document: {} } }, // missing required 'name'
      ])
    ).rejects.toThrow()

    expect(bulkWriteSpy).not.toHaveBeenCalled()
  })

  it('should filter private fields on insertOne ops before dispatch', async () => {
    const dataSource = new MockDataSource({})

    const user = new Repo({
      name: 'user',
      collectionName: 'users',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: true } },
      },
    })
    user.dataSource = dataSource

    await user.bulkWrite(
      [
        {
          insertOne: {
            document: { name: 'Kevin', cannotInsertThisValue: 'test' },
          },
        },
      ],
      { filterPrivate: true }
    )

    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].cannotInsertThisValue).toBeUndefined()
  })
})
