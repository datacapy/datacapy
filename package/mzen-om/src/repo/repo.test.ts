import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('Repo', () => {
  describe('getName()', () => {
    it('should return configured name', () => {
      var userRepo = new Repo({ name: 'UserRepo' })
      expect(userRepo.getName()).toBe('UserRepo')
    })
    it('should return constructor name if name not configured', () => {
      class UserRepo extends Repo<any> {}
      var userRepo = new UserRepo()
      expect(userRepo.getName()).toBe('UserRepo')

      class NewUserRepo extends UserRepo {}
      var newUserRepo = new NewUserRepo()
      expect(newUserRepo.getName()).toBe('NewUserRepo')
    })
    it('should throw an exception if repo name is not configured when using the default constructor', () => {
      var aRepo = new Repo()
      expect(() => {
        aRepo.getName()
      }).toThrow('Repo name not configured')
    })
  })
  describe('count()', () => {
    it('should return document count', async () => {
      var data = {
        user: [
          { _id: '1', name: 'Kevin Foster', userTimezoneId: '1' },
          { _id: '2', name: 'Claire Foster', userTimezoneId: '1' },
          { _id: '3', name: 'Lisa Foster', userTimezoneId: '1' },
        ],
      }

      var userRepo = new Repo({
        name: 'user',
        relations: {
          userTimezone: {
            type: 'belongsTo',
            repo: 'userTimezone',
            key: 'userTimezoneId',
            autoPopulate: false,
          },
        },
      })
      userRepo.dataSource = new MockDataSource(data)

      const result = await userRepo.count({})
      expect(result).toBe(3)
    })
  })
  describe('populateAll()', () => {
    it('should populate relations', async () => {
      var data = {
        userTimezone: [{ _id: '1', name: 'Europe/London' }],
        user: [{ _id: '1', name: 'Kevin Foster', userTimezoneId: '1' }],
      }

      var userRepo = new Repo({
        name: 'user',
        relations: {
          userTimezone: {
            type: 'belongsToOne',
            repo: 'userTimezone',
            key: 'userTimezoneId',
            autoPopulate: false,
          },
        },
      })
      userRepo.dataSource = new MockDataSource(data)

      var userTimezoneRepo = new Repo({
        name: 'userTimezone',
      })
      userTimezoneRepo.dataSource = new MockDataSource(data)
      userRepo.repos.userTimezone = userTimezoneRepo

      var docs = await userRepo.find()
      expect(docs[0]).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
      })

      await userRepo.populateAll(docs, { populate: { userTimezone: true } })
      expect(docs[0]).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
        userTimezone: { _id: '1', name: 'Europe/London' },
      })
    })
    it('should load relation by performing one query per document if limit option was specified', async () => {
      type Person = {
        _id: string
        name: string
      }
      type Mother = {
        _id: string
        name: string
        children: Person[]
      }

      var data = {
        mother: [
          { _id: '5', name: 'Alison' },
          { _id: '6', name: 'Gina' },
        ],
        child: [
          { _id: '1', motherId: '5', name: 'Kevin' },
          { _id: '2', motherId: '5', name: 'Lisa' },
          { _id: '3', motherId: '5', name: 'Claire' },
          { _id: '4', motherId: '6', name: 'Ian' },
          { _id: '5', motherId: '6', name: 'Brenda' },
          { _id: '6', motherId: '6', name: 'Alison' },
        ],
      }
      var dataSource = new MockDataSource(data)

      var motherRepo = new Repo({
        name: 'mother',
        relations: {
          children: {
            type: 'hasMany',
            repo: 'child',
            key: 'motherId',
            alias: 'children',
            limit: 1,
            autoPopulate: false,
          },
        },
      }) as Repo<Mother>
      motherRepo.dataSource = dataSource

      var childRepo = new Repo({
        name: 'child',
      }) as Repo<Person>
      childRepo.dataSource = dataSource
      motherRepo.repos.child = childRepo

      var docs = await motherRepo.find()

      await motherRepo.populateAll(docs, { populate: { children: true } })
      // Query count should be 3
      // - 1 for the initial find query and then 2 for populating relations
      expect(dataSource.queryCount).toBe(3)
      expect(docs[0].children.length).toBe(1)
      expect(docs[1].children.length).toBe(1)
    })
  })
  describe('populate()', () => {
    it('should populate single relation by name', async () => {
      var data = {
        userTimezone: [{ _id: '1', name: 'Europe/London' }],
        user: [{ _id: '1', name: 'Kevin Foster', userTimezoneId: '1' }],
      }

      var userRepo = new Repo({
        name: 'user',
        relations: {
          userTimezone: {
            type: 'belongsToOne',
            repo: 'userTimezone',
            key: 'userTimezoneId',
            autoPopulate: false,
          },
        },
      })
      userRepo.dataSource = new MockDataSource(data)

      var userTimezoneRepo = new Repo({
        name: 'userTimezone',
      })
      userTimezoneRepo.dataSource = new MockDataSource(data)
      userRepo.repos.userTimezone = userTimezoneRepo

      var docs = await userRepo.find()
      expect(docs[0]).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
      })

      await userRepo.populate('userTimezone', docs, {})
      expect(docs[0]).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
        userTimezone: { _id: '1', name: 'Europe/London' },
      })
    })
    it('should populate single relation by config object', async () => {
      var data = {
        userTimezone: [{ _id: '1', name: 'Europe/London' }],
        user: [{ _id: '1', name: 'Kevin Foster', userTimezoneId: '1' }],
      }

      var userRepo = new Repo<any>({
        name: 'user',
        relations: {
          userTimezone: {
            type: 'belongsToOne',
            repo: 'userTimezone',
            key: 'userTimezoneId',
            autoPopulate: false,
          },
        },
      })
      userRepo.dataSource = new MockDataSource(data)

      var userTimezoneRepo = new Repo({
        name: 'userTimezone',
      })
      userTimezoneRepo.dataSource = new MockDataSource(data)
      userRepo.repos.userTimezone = userTimezoneRepo

      var docs = await userRepo.find()
      expect(docs[0]).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
      })

      if (userRepo.config.relations?.userTimezone) {
        await userRepo.populate(
          userRepo.config.relations.userTimezone,
          docs,
          {}
        )
        expect(docs[0]).toEqual({
          _id: '1',
          name: 'Kevin Foster',
          userTimezoneId: '1',
          userTimezone: { _id: '1', name: 'Europe/London' },
        })
      }
    })
    it('should load relation by performing one query per document if limit option was specified', async () => {
      type Person = {
        _id: string
        name: string
      }
      type Mother = {
        _id: string
        name: string
        children: Person[]
      }

      var data = {
        mother: [
          { _id: '5', name: 'Alison' },
          { _id: '6', name: 'Gina' },
        ],
        child: [
          { _id: '1', motherId: '5', name: 'Kevin' },
          { _id: '2', motherId: '5', name: 'Lisa' },
          { _id: '3', motherId: '5', name: 'Claire' },
          { _id: '4', motherId: '6', name: 'Ian' },
          { _id: '5', motherId: '6', name: 'Brenda' },
          { _id: '6', motherId: '6', name: 'Alison' },
        ],
      }
      var dataSource = new MockDataSource(data)

      var motherRepo = new Repo({
        name: 'mother',
        relations: {
          children: {
            type: 'hasMany',
            repo: 'child',
            key: 'motherId',
            alias: 'children',
            limit: 1,
            autoPopulate: false,
          },
        },
      }) as Repo<Mother>
      motherRepo.dataSource = dataSource

      var childRepo = new Repo({
        name: 'child',
      }) as Repo<Person>
      childRepo.dataSource = dataSource
      motherRepo.repos.child = childRepo

      var docs = await motherRepo.find()

      await motherRepo.populate('children', docs)
      // Query count should be 3
      // - 1 for the initial find query and then 2 for populating relations
      expect(dataSource.queryCount).toBe(3)
      expect(docs[0].children.length).toBe(1)
      expect(docs[1].children.length).toBe(1)
    })
  })
  describe('stripTransients()', () => {
    it('should strip relations', () => {
      var user = new Repo<any>({
        name: 'user',
        relations: {
          userTimezone: {
            type: 'belongsTo',
            repo: 'userTimezone',
            key: 'userTimezoneId',
            autoPopulate: true,
          },
        },
      })

      var result = user.stripTransients({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
        userTimezone: { _id: '1', name: 'Europe/London' },
      })

      expect(result).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezoneId: '1',
      })
    })
    it('should strip pathrefs', () => {
      var userRepo = new Repo({
        name: 'user',
        schema: {
          _id: String,
          name: String,
          userTimezone: {
            _id: String,
            userId: { $pathRef: '_id' },
            name: String,
          },
        },
      })

      var user = userRepo.stripTransients({
        _id: '1',
        name: 'Kevin Foster',
        userTimezone: { _id: '33', userId: '1', name: 'Europe/London' },
      })

      expect(user).toEqual({
        _id: '1',
        name: 'Kevin Foster',
        userTimezone: { _id: '33', name: 'Europe/London' },
      })
    })
  })
  describe('insert()', () => {
    // Since we separated schema definition from Repos the 'strict' option can no longer be passed in repo options
    // - we need to add the ability to specify the $strict option within the schema spec itself
    /*
    it('should fail validation in strict mode if contains unspecified properties', async () => {
      var data = {
        user: [
          {_id: '1', name: 'Kevin Foster', age: 33}
        ]
      };

      var userRepo = new Repo({
        name: 'user',
        strict: false,
        schema: {
          _id: Number,
          name: String
        }
      });
      userRepo.dataSource = new MockDataSource(data);

      var userRepoStrict = new Repo({
        name: 'user',
        strict: true,
        schema: {
          _id: Number,
          name: String
        }
      });
      userRepoStrict.dataSource = new MockDataSource(data);

      userRepo.insertOne(data.user[0]).catch(function(err){
        should(err).be.undefined();
      });

      userRepoStrict.insertOne(data.user[0]).catch(function(err){
        should(err).be.type('object');
        done();
      }).catch(function(err){
        done(err);
      });
    });
    */
  })

  describe('hasIndexes()', () => {
    it('should return false when indexes is not configured', () => {
      const repo = new Repo({ name: 'user', collectionName: 'user' })
      expect(repo.hasIndexes()).toBe(false)
    })
    it('should return false when indexes is an empty object', () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        indexes: {},
      })
      expect(repo.hasIndexes()).toBe(false)
    })
    it('should return true when at least one index is configured', () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        indexes: { emailIndex: { spec: { email: 1 } } },
      })
      expect(repo.hasIndexes()).toBe(true)
    })
  })

  describe('createIndexes()', () => {
    it('should throw when no indexes are configured', async () => {
      const repo = new Repo({ name: 'user', collectionName: 'user' })
      repo.dataSource = new MockDataSource({})
      await expect(repo.createIndexes()).rejects.toThrow(
        'Repo "user" has no indexes configured'
      )
    })
    it('should throw when indexes is an empty object', async () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        indexes: {},
      })
      repo.dataSource = new MockDataSource({})
      await expect(repo.createIndexes()).rejects.toThrow(
        'Repo "user" has no indexes configured'
      )
    })
    it('should call createIndex on the datasource for each configured index', async () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        indexes: {
          emailIndex: { spec: { email: 1 } },
          nameIndex: { spec: { name: 1 } },
        },
      })
      const dataSource = new MockDataSource({})
      repo.dataSource = dataSource
      await repo.createIndexes()
      expect(dataSource.queryCount).toBe(2)
    })
  })

  describe('init()', () => {
    it('should not call createIndexes when autoIndex is true but no indexes are configured', async () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        autoIndex: true,
      })
      const dataSource = new MockDataSource({})
      repo.dataSource = dataSource
      await repo.init()
      expect(dataSource.queryCount).toBe(0)
    })
    it('should call createIndexes when autoIndex is true and indexes are configured', async () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        autoIndex: true,
        indexes: { emailIndex: { spec: { email: 1 } } },
      })
      const dataSource = new MockDataSource({})
      repo.dataSource = dataSource
      await repo.init()
      expect(dataSource.queryCount).toBe(1)
    })
    it('should not call createIndexes when autoIndex is false', async () => {
      const repo = new Repo({
        name: 'user',
        collectionName: 'user',
        autoIndex: false,
        indexes: { emailIndex: { spec: { email: 1 } } },
      })
      const dataSource = new MockDataSource({})
      repo.dataSource = dataSource
      await repo.init()
      expect(dataSource.queryCount).toBe(0)
    })
  })

  describe('getDataSource()', () => {
    it('returns the active datasource bound on the context, bypassing the registry', async () => {
      const { DataSourceContext } = require('data-source/context')
      const { DataSourceDynamic } = require('data-source/dynamic')

      const repo = new Repo({ name: 'r1', dataSource: 'project' })
      // Mark the repo's static datasource as dynamic so a registry lookup would normally be
      // attempted - but no modelManager is wired up, so any registry-path resolution would throw.
      repo.dataSource = new DataSourceDynamic()

      const lease = new MockDataSource({})
      const context = new DataSourceContext().withActiveDataSource(
        'project',
        lease
      )

      const resolved = await repo.getDataSource(context)
      expect(resolved).toBe(lease)
    })

    it('falls through to registry resolution when no active datasource is bound', async () => {
      const { DataSourceContext } = require('data-source/context')

      const repo = new Repo({ name: 'r1' })
      const dataSource = new MockDataSource({})
      repo.dataSource = dataSource

      const context = new DataSourceContext()

      const resolved = await repo.getDataSource(context)
      expect(resolved).toBe(dataSource)
    })
  })

  require('./find.test')
  require('./find-one.test')
  require('./insert-many.test')
  require('./insert-one.test')
  require('./update-many.test')
  require('./update-one.test')
})
