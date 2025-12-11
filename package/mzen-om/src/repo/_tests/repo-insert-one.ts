import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('insertOne()', () => {
  it('should type cast documents', async () => {
    let data = {
      user: [{ _id: '1', name: 'Kevin', number: '123', string: 543 }],
    }

    const dataSource = new MockDataSource(data)
    let user = new Repo({
      name: 'user',
      schema: {
        name: String,
        number: { $type: Number },
        string: { $type: String },
      },
    })
    user.dataSource = dataSource

    await user.insertOne(data.user[0], { filterPrivate: true })
    expect(dataSource.dataInsert[0].number).toBe(123)
    expect(dataSource.dataInsert[0].string).toBe('543')
  })

  it('should filter private fields', async () => {
    let data = {
      user: [{ _id: '1', name: 'Kevin', cannotInsertThisValue: 'test' }],
    }

    const dataSource = new MockDataSource(data)
    let user = new Repo({
      name: 'user',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: true } },
      },
    })
    user.dataSource = dataSource

    await user.insertOne(data.user[0], { filterPrivate: true })
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].cannotInsertThisValue).toBeUndefined()
  })

  it('should filter private "write" fields', async () => {
    let data = {
      user: [{ _id: '1', name: 'Kevin', cannotInsertThisValue: 'test' }],
    }

    const dataSource = new MockDataSource(data)
    let user = new Repo({
      name: 'user',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: 'write' } },
      },
    })
    user.dataSource = dataSource

    await user.insertOne(data.user[0], { filterPrivate: true })
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].cannotInsertThisValue).toBeUndefined()
  })

  it('should not filter private "read" fields', async () => {
    let data = {
      user: [{ _id: '1', name: 'Kevin', canInsertThisValue: 'test' }],
    }

    const dataSource = new MockDataSource(data)
    let user = new Repo({
      name: 'user',
      schema: {
        name: String,
        canInsertThisValue: { $type: String, $filter: { private: 'read' } },
      },
    })
    user.dataSource = dataSource

    await user.insertOne(data.user[0], { filterPrivate: true })
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].canInsertThisValue).toBe('test')
  })

  it('should not filter private fields by default', async () => {
    let data = {
      user: [{ _id: '1', name: 'Kevin', canInsertThisValue: 'test' }],
    }

    const dataSource = new MockDataSource(data)
    let user = new Repo({
      name: 'user',
      schema: {
        name: String,
        canInsertThisValue: { $type: String, $filter: { private: true } },
      },
    })
    user.dataSource = dataSource

    await user.insertOne(data.user[0])
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].canInsertThisValue).toBe('test')
  })
})
