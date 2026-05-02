import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('upsertOne()', function () {
  it('should filter private "write" fields', async () => {
    var updateData = {
      $set: {
        name: 'Kevin',
        cannotInsertThisValue: '123',
      },
    }

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: 'write' } },
      },
    })
    const dataSource = new MockDataSource({})
    user.dataSource = dataSource

    await user.upsertOne({}, updateData, { filterPrivate: true })
    expect(dataSource.dataUpdate[0]['$set'].name).toBe('Kevin')
    expect(
      dataSource.dataUpdate[0]['$set'].cannotInsertThisValue
    ).toBeUndefined()
  })

  it('should not filter private "read" fields', async () => {
    var updateData = {
      $set: {
        name: 'Kevin',
        canUpdateThisValue: '123',
      },
    }

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        canUpdateThisValue: { $type: String, $filter: { private: 'read' } },
      },
    })
    const dataSource = new MockDataSource({})
    user.dataSource = dataSource

    await user.upsertOne({}, updateData, { filterPrivate: true })
    expect(dataSource.dataUpdate[0]['$set'].name).toBe('Kevin')
    expect(dataSource.dataUpdate[0]['$set'].canUpdateThisValue).toBe('123')
  })

  it('should filter private fields', async () => {
    var updateData = {
      $set: {
        name: 'Kevin',
        cannotInsertThisValue: '123',
      },
    }

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        cannotInsertThisValue: { $type: String, $filter: { private: true } },
      },
    })
    const dataSource = new MockDataSource({})
    user.dataSource = dataSource

    await user.upsertOne({}, updateData, { filterPrivate: true })
    expect(dataSource.dataUpdate[0]['$set'].name).toBe('Kevin')
    expect(
      dataSource.dataUpdate[0]['$set'].cannotInsertThisValue
    ).toBeUndefined()
  })

  it('should not filter private fields by default', async () => {
    var updateData = {
      $set: {
        name: 'Kevin',
        canUpdateThisValue: '123',
      },
    }

    var user = new Repo({
      name: 'user',
      schema: {
        name: String,
        canUpdateThisValue: { $type: String, $filter: { private: true } },
      },
    })
    const dataSource = new MockDataSource({})
    user.dataSource = dataSource

    await user.upsertOne({}, updateData)
    expect(dataSource.dataUpdate[0]['$set'].name).toBe('Kevin')
    expect(dataSource.dataUpdate[0]['$set'].canUpdateThisValue).toBe('123')
  })

  it('should return type casted documents', async () => {
    var updateData = {
      $set: {
        number: '123',
        string: 543,
      },
    }

    var user = new Repo({
      name: 'user',
      schema: {
        number: { $type: Number },
        string: { $type: String },
      },
    })
    const dataSource = new MockDataSource({})
    user.dataSource = dataSource

    await user.upsertOne({}, updateData, { filterPrivate: true })
    expect(dataSource.dataUpdate[0]['$set'].number).toBe(123)
    expect(dataSource.dataUpdate[0]['$set'].string).toBe('543')
  })
})
