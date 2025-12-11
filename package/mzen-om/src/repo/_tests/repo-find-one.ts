import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('findOne()', function () {
  it('should find queried data', async () => {
    class User {
      _id?: string
      name?: string
    }

    var data = {
      user: [{ _id: '1', name: 'Kevin Foster' }],
    }

    var user = new Repo({
      name: 'user',
    }) as Repo<User>
    user.dataSource = new MockDataSource(data)

    var doc = await user.findOne()
    expect(doc?.name).toBe('Kevin Foster')
  })
  it('should filter private fields via filterPrivate option', async () => {
    class User {
      _id?: string
      name?: string
      password?: string
    }

    var data = {
      user: [
        { _id: '1', name: 'Alison', password: 'Abc' },
        { _id: '2', name: 'Gina', password: '123' },
      ],
    }
    var dataSource = new MockDataSource(data)

    var repo = new Repo({
      name: 'user',
      schema: {
        password: {
          $type: String,
          $filter: { private: true },
        },
      },
    }) as Repo<User>
    repo.dataSource = dataSource

    var doc = await repo.findOne({}, { filterPrivate: true })
    expect(doc?.name).toBe('Alison')
    expect(doc?.password).toBeUndefined()
  })
  it('should not filter private fields by default', async () => {
    class User {
      _id?: string
      name?: string
      password?: string
    }

    var data = {
      user: [{ _id: '1', name: 'Alison', password: 'Abc' }],
    }
    var dataSource = new MockDataSource(data)

    var repo = new Repo({
      name: 'user',
      schema: {
        password: {
          $type: String,
          $filter: { private: true },
        },
      },
    }) as Repo<User>
    repo.dataSource = dataSource

    var doc = await repo.findOne()
    expect(doc?.name).toBe('Alison')
    expect(doc?.password).toBe('Abc')
  })

  require('./repo-find-one/find-one-constructor')
  require('./repo-find-one/find-one-relation')
})
