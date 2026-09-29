import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('find()', () => {
  it('should find queried data', async () => {
    type User = {
      name: string
    }

    var data = {
      user: [
        { _id: '1', name: 'Kevin Foster' },
        { _id: '2', name: 'Tom Murphy' },
      ],
    }

    var user = new Repo({
      name: 'user',
    }) as Repo<User>
    user.dataSource = new MockDataSource(data)

    var docs = await user.find()
    expect(docs[0].name).toBe('Kevin Foster')
    expect(docs[1].name).toBe('Tom Murphy')
  })

  it('should filter private fields via filterPrivate option', async () => {
    type User = {
      name: string
      password: string
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
      schema: { password: { $type: String, $filter: { private: true } } },
    }) as Repo<User>
    repo.dataSource = dataSource

    var docs = await repo.find({}, { filterPrivate: true })
    expect(docs[0].name).toBe('Alison')
    expect(docs[0].password).toBeUndefined()
    expect(docs[1].name).toBe('Gina')
    expect(docs[1].password).toBeUndefined()
  })

  it('should not filter fields by default', async () => {
    type User = {
      name: string
      password: string
    }

    var data = {
      user: [{ _id: '1', name: 'Alison', password: 'Abc' }],
    }
    var dataSource = new MockDataSource(data)

    var repo = new Repo({
      name: 'user',
      schema: { password: { $type: String, $filter: { private: true } } },
    }) as Repo<User>
    repo.dataSource = dataSource

    var docs = await repo.find()
    expect(docs[0].name).toBe('Alison')
    expect(docs[0].password).toBe('Abc')
  })

  // Import other test files
  require('./find-relation.test')
})
