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
    // Since we seperated schema defination from Repos the 'strict' option can no longer be passed in repo options
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

  require('./repo-find')
  require('./repo-find-one')
  require('./repo-insert-many')
  require('./repo-insert-one')
  require('./repo-update-many')
  require('./repo-update-one')
})
