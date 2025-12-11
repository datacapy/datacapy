import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('insertMany()', function () {
  it('should return type casted documents', async () => {
    var data = {
      user: [{ _id: '1', name: 'Kevin', number: '123', string: 543 }],
    }
    const dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        number: { $type: Number },
        string: { $type: String },
      },
    })
    user.dataSource = dataSource

    await user.insertMany(data.user, { filterPrivate: true })
    expect(dataSource.dataInsert[0].number).toBe(123)
    expect(dataSource.dataInsert[0].string).toBe('543')
  })

  it('should filter private fields', async () => {
    var data = {
      user: [{ _id: '1', name: 'Kevin', cannotInsertThisValue: 'test' }],
    }
    const dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: true } },
      },
    })
    user.dataSource = dataSource

    await user.insertMany(data.user, { filterPrivate: true })
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].cannotInsertThisValue).toBeUndefined()
  })

  it('should filter private "write" fields', async () => {
    var data = {
      user: [{ _id: '1', name: 'Kevin', cannotInsertThisValue: 'test' }],
    }
    const dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: 'write' } },
      },
    })
    user.dataSource = dataSource

    await user.insertMany(data.user, { filterPrivate: true })
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].cannotInsertThisValue).toBeUndefined()
  })

  it('should not filter private "read" fields', async () => {
    var data = {
      user: [{ _id: '1', name: 'Kevin', canInsertThisValue: 'test' }],
    }
    const dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        canInsertThisValue: { $type: String, $filter: { private: 'read' } },
      },
    })
    user.dataSource = dataSource

    await user.insertMany(data.user, { filterPrivate: true })
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].canInsertThisValue).toBe('test')
  })

  it('should not filter private fields by default', async () => {
    var data = {
      user: [{ _id: '1', name: 'Kevin', canInsertThisValue: 'test' }],
    }
    const dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        canInsertThisValue: { $type: String, $filter: { private: true } },
      },
    })
    user.dataSource = dataSource

    await user.insertMany(data.user)
    expect(dataSource.dataInsert[0].name).toBe('Kevin')
    expect(dataSource.dataInsert[0].canInsertThisValue).toBe('test')
  })
})
