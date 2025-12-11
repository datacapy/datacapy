import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('Repo', () => {
  describe('getName()', () => {
    it('should return configured name', () => {
      var user = new Repo({
        name: 'user',
      })
      expect(user.getName()).toBe('user')
    })

    it('should return constructor name if name not configured', () => {
      class UserRepo extends Repo<any> {}
      var user = new UserRepo()
      expect(user.getName()).toBe('UserRepo')
    })

    it('should throw an exception if repo name is not configured when using the default constructor', () => {
      expect(() => {
        var user = new Repo()
        user.getName()
      }).toThrow('Repo name not configured')
    })
  })

  describe('insertOne()', () => {
    it('should insertOne data', async () => {
      class User {
        _id: string = ''
        name: string = ''
      }

      var user = new Repo({
        name: 'user',
      })
      const dataSource = new MockDataSource({})
      user.dataSource = dataSource

      await user.insertOne({ name: 'Kevin' })
      expect(dataSource.dataInsert[0].name).toBe('Kevin')
    })

    it('should filter private fields via filterPrivate option', async () => {
      var user = new Repo({
        name: 'user',
        schema: {
          name: String,
          password: { $type: String, $filter: { private: 'write' } },
        },
      })
      const dataSource = new MockDataSource({})
      user.dataSource = dataSource

      await user.insertOne(
        { name: 'Kevin', password: '123' },
        { filterPrivate: true }
      )
      expect(dataSource.dataInsert[0].name).toBe('Kevin')
      expect(dataSource.dataInsert[0].password).toBeUndefined()
    })

    it('should not filter private fields by default', async () => {
      var user = new Repo({
        name: 'user',
        schema: {
          name: String,
          password: { $type: String, $filter: { private: 'write' } },
        },
      })
      const dataSource = new MockDataSource({})
      user.dataSource = dataSource

      await user.insertOne({ name: 'Kevin', password: '123' })
      expect(dataSource.dataInsert[0].name).toBe('Kevin')
      expect(dataSource.dataInsert[0].password).toBe('123')
    })
  })

  describe('updateOne()', () => {
    it('should updateOne data', async () => {
      var user = new Repo({
        name: 'user',
      })
      const dataSource = new MockDataSource({})
      user.dataSource = dataSource

      await user.updateOne({ _id: '1' }, { name: 'Kevin' })
      expect(dataSource.dataUpdate[0].name).toBe('Kevin')
    })

    it('should filter private fields via filterPrivate option', async () => {
      var user = new Repo({
        name: 'user',
        schema: {
          name: String,
          password: { $type: String, $filter: { private: 'write' } },
        },
      })
      const dataSource = new MockDataSource({})
      user.dataSource = dataSource

      await user.updateOne(
        { _id: '1' },
        { $set: { name: 'Kevin', password: '123' } },
        { filterPrivate: true }
      )
      expect(dataSource.dataUpdate[0].$set.name).toBe('Kevin')
      expect(dataSource.dataUpdate[0].$set.password).toBeUndefined()
    })

    it('should not filter private fields by default', async () => {
      var user = new Repo({
        name: 'user',
        schema: {
          name: String,
          password: { $type: String, $filter: { private: 'write' } },
        },
      })
      const dataSource = new MockDataSource({})
      user.dataSource = dataSource

      await user.updateOne(
        { _id: '1' },
        { $set: { name: 'Kevin', password: '123' } }
      )
      expect(dataSource.dataUpdate[0].$set.name).toBe('Kevin')
      expect(dataSource.dataUpdate[0].$set.password).toBe('123')
    })
  })
})
