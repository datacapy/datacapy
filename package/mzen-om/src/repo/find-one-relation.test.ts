import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('relation', function () {
  it('should populate hasOne relation', async () => {
    class Timezone {
      name: string
      constructor() {
        this.name = ''
      }
    }
    class User {
      name: string
      userTimezone?: Timezone
      constructor() {
        this.name = ''
      }
    }

    var data = {
      userTimezone: [{ _id: '1', userId: '1', name: 'Europe/London' }],
      user: [{ _id: '1', name: 'Kevin Foster' }],
    }
    var dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'hasOne',
          repo: 'userTimezone',
          key: 'userId',
          alias: 'userTimezone',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    user.dataSource = dataSource

    var userTimezone = new Repo({
      name: 'userTimezone',
    })
    userTimezone.dataSource = dataSource
    user.repos.userTimezone = userTimezone

    var doc = await user.findOne()
    expect(doc?.name).toBe('Kevin Foster')
    expect(doc?.userTimezone?.name).toBe('Europe/London')
  })
  it('should populate belongsTo relation', async () => {
    class Timezone {
      name: string
      constructor() {
        this.name = ''
      }
    }
    class User {
      name: string
      userTimezone?: Timezone
      constructor() {
        this.name = ''
      }
    }

    var data = {
      userTimezone: [{ _id: '1', name: 'Europe/London' }],
      user: [{ _id: '1', name: 'Kevin Foster', userTimezoneId: '1' }],
    }
    var dataSource = new MockDataSource(data)

    var user = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'userTimezone',
          key: 'userTimezoneId',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    user.dataSource = dataSource

    var userTimezone = new Repo({
      name: 'userTimezone',
    }) as Repo<Timezone>
    userTimezone.dataSource = dataSource
    user.repos.userTimezone = userTimezone

    var doc = await user.findOne()
    expect(doc.name).toBe('Kevin Foster')
    expect(doc.userTimezone?.name).toBe('Europe/London')
  })
  it('should populate hasMany relation', async () => {
    class Album {
      _id: string
      name: string
      constructor() {
        this._id = ''
        this.name = ''
      }
    }
    class Artist {
      name: string
      artistId: string
      albums: Album[]
      constructor() {
        this.name = ''
        this.artistId = ''
        this.albums = []
      }
    }

    var data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
        { _id: '3', name: 'OK Computer', artistId: '1' },
        { _id: '4', name: 'Kid A', artistId: '1' },
      ],
    }
    var dataSource = new MockDataSource(data)

    var artist = new Repo({
      name: 'artist',
      relations: {
        albums: {
          type: 'hasMany',
          repo: 'album',
          key: 'artistId',
          autoPopulate: true,
        },
      },
    }) as Repo<Artist>
    artist.dataSource = dataSource

    var album = new Repo({
      name: 'album',
    }) as Repo<Album>
    album.dataSource = dataSource
    artist.repos['album'] = album

    var doc = await artist.findOne()
    expect(doc.albums[0].name).toBe('Pablo Honey')
    expect(doc.albums[1].name).toBe('The Bends')
    expect(doc.albums[2].name).toBe('OK Computer')
    expect(doc.albums[3].name).toBe('Kid A')
  })
  it('should populate self relation with one level of recursion only', async () => {
    class User {
      name: string
      referer?: User
      referred: User[]
      constructor() {
        this.name = ''
        this.referred = []
      }
    }

    var data = {
      user: [
        { _id: '1', name: 'Kevin' },
        { _id: '2', name: 'Tom', referredByUserId: '1' },
        { _id: '3', name: 'Sarah', referredByUserId: '1' },
      ],
    }

    var user = new Repo({
      name: 'user',
      relations: {
        referred: {
          type: 'hasMany',
          repo: 'user',
          key: 'referredByUserId',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    user.dataSource = new MockDataSource(data)
    user.repos['user'] = user

    var doc = await user.findOne()
    expect(doc.name).toBe('Kevin')
    expect(doc.referer).toBeUndefined()
    expect(doc.referred[0].name).toBe('Tom')
    expect(doc.referred[0].referer).toBeUndefined()
    expect(doc.referred[1].name).toBe('Sarah')
    expect(doc.referred[1].referer).toBeUndefined()
  })
  it('should allow relation to be enabled via populate option', async () => {
    class Timezone {
      name: string
      constructor() {
        this.name = ''
      }
    }
    class User {
      name: string
      userTimezone?: Timezone
      constructor() {
        this.name = ''
      }
    }

    var data = {
      userTimezone: [{ _id: '1', name: 'Europe/London' }],
      user: [{ _id: '1', timezoneId: '1', name: 'Kevin Foster' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'userTimezone',
          key: 'timezoneId',
          alias: 'userTimezone',
          autoPopulate: false,
        },
      },
    }) as Repo<User>
    userRepo.dataSource = dataSource

    var userTimezoneRepo = new Repo({
      name: 'userTimezone',
    }) as Repo<Timezone>
    userTimezoneRepo.dataSource = dataSource
    userRepo.repos.userTimezone = userTimezoneRepo

    var doc = await userRepo.findOne({}, { populate: { userTimezone: true } })
    expect(doc.userTimezone?.name).toBe('Europe/London')
  })
  it('should allow relation to be disabled via populate option', async () => {
    class Timezone {
      name: string
      constructor() {
        this.name = ''
      }
    }
    class User {
      name: string
      userTimezone: Timezone
      constructor() {
        this.name = ''
        this.userTimezone = new Timezone()
      }
    }

    var data = {
      userTimezone: [{ _id: '1', name: 'Europe/London' }],
      user: [{ _id: '1', timezoneId: '1', name: 'Kevin Foster' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'userTimezone',
          key: 'timezoneId',
          alias: 'userTimezone',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    userRepo.dataSource = dataSource

    var userTimezoneRepo = new Repo({
      name: 'userTimezone',
    }) as Repo<Timezone>
    userTimezoneRepo.dataSource = dataSource
    userRepo.repos.userTimezone = userTimezoneRepo

    var doc = await userRepo.findOne({}, { populate: { userTimezone: false } })
    expect(doc.userTimezone).toBeUndefined()
  })
  it('should allow nested relation to be enabled via populate option', async () => {
    class Country {
      name: string
      constructor() {
        this.name = ''
      }
    }
    class Timezone {
      name: string
      country?: Country
      constructor() {
        this.name = ''
      }
    }
    class User {
      name: string
      userTimezone?: Timezone
      constructor() {
        this.name = ''
      }
    }

    var data = {
      country: [{ _id: '1', name: 'UK' }],
      userTimezone: [{ _id: '1', countryId: '1', name: 'Europe/London' }],
      user: [{ _id: '1', userTimezoneId: '1', name: 'Kevin Foster' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'userTimezone',
          key: 'userTimezoneId',
          alias: 'userTimezone',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    userRepo.dataSource = dataSource

    var userTimezoneRepo = new Repo({
      name: 'userTimezone',
      relations: {
        country: {
          type: 'belongsToOne',
          repo: 'country',
          key: 'countryId',
          alias: 'country',
          recursion: 1,
          autoPopulate: false, // important - initialy the relation is configured not to populate
        },
      },
    }) as Repo<Timezone>
    userTimezoneRepo.dataSource = dataSource
    userRepo.repos.userTimezone = userTimezoneRepo

    var countryRepo = new Repo({
      name: 'country',
    }) as Repo<Country>
    countryRepo.dataSource = dataSource
    userTimezoneRepo.repos.country = countryRepo
    userRepo.repos.country = countryRepo

    var doc = await userRepo.findOne(
      {},
      { populate: { 'userTimezone.country': true } }
    )
    expect(doc.userTimezone?.country?.name).toBe('UK')
  })
  it('should allow nested relation to be disabled via populate option', async () => {
    class Country {
      name: string
      constructor() {
        this.name = ''
      }
    }
    class Timezone {
      name: string
      country?: Country
      constructor() {
        this.name = ''
      }
    }
    class User {
      name: string
      userTimezone?: Timezone
      constructor() {
        this.name = ''
      }
    }

    var data = {
      country: [{ _id: '1', name: 'UK' }],
      userTimezone: [{ _id: '1', countryId: '1', name: 'Europe/London' }],
      user: [{ _id: '1', userTimezoneId: '1', name: 'Kevin Foster' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'userTimezone',
          key: 'userTimezoneId',
          alias: 'userTimezone',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    userRepo.dataSource = dataSource

    var userTimezoneRepo = new Repo({
      name: 'userTimezone',
      relations: {
        country: {
          type: 'belongsToOne',
          repo: 'country',
          key: 'countryId',
          alias: 'country',
          recursion: 1,
          autoPopulate: true, // important - initialy the relation is configured not to populate
        },
      },
    }) as Repo<Timezone>
    userTimezoneRepo.dataSource = dataSource
    userRepo.repos.userTimezone = userTimezoneRepo

    var countryRepo = new Repo({
      name: 'country',
    }) as Repo<Country>
    countryRepo.dataSource = dataSource
    userTimezoneRepo.repos.country = countryRepo
    userRepo.repos.country = countryRepo

    var doc = await userRepo.findOne(
      {},
      { populate: { 'userTimezone.country': false } }
    )
    expect(doc.userTimezone?.name).toBe('Europe/London')
    expect(doc.userTimezone?.country).toBeUndefined()
  })
  it('should not recurse relations by default', async () => {
    class Person {
      _id: string
      name: string
      mother?: Mother
      constructor() {
        this._id = ''
        this.name = ''
      }
    }
    class Mother {
      _id: string
      name: string
      children: Person[]
      constructor() {
        this._id = ''
        this.name = ''
        this.children = []
      }
    }

    var data = {
      mother: [{ _id: '1', name: 'Alison' }],
      child: [{ _id: '1', motherId: '1', name: 'Kevin' }],
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
          autoPopulate: true,
        },
      },
    }) as Repo<Mother>
    motherRepo.dataSource = dataSource
    motherRepo.repos.mother = motherRepo

    var childRepo = new Repo({
      name: 'child',
      relations: {
        mother: {
          type: 'belongsToOne',
          repo: 'mother',
          key: 'motherId',
          alias: 'mother',
          autoPopulate: true,
        },
      },
    }) as Repo<Person>
    childRepo.dataSource = dataSource
    childRepo.repos.mother = motherRepo
    motherRepo.repos.child = childRepo

    var doc = await motherRepo.findOne()
    expect(doc.name).toBe('Alison')
    expect(doc.children[0].name).toBe('Kevin')
    expect(doc.children[0].mother?.name).toBe('Alison')
    expect(doc.children[0].mother?.children).toBeUndefined()
  })
  it('should recurse relation up to recursion config value 1', async () => {
    class Person {
      _id: string
      name: string
      mother?: Mother
      constructor() {
        this._id = ''
        this.name = ''
      }
    }
    class Mother {
      _id: string
      name: string
      children: Person[]
      constructor() {
        this._id = ''
        this.name = ''
        this.children = []
      }
    }

    var data = {
      mother: [{ _id: '1', name: 'Alison' }],
      child: [{ _id: '1', motherId: '1', name: 'Kevin' }],
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
          autoPopulate: true,
          recursion: 1,
        },
      },
    }) as Repo<Mother>
    motherRepo.dataSource = dataSource
    motherRepo.repos.mother = motherRepo

    var childRepo = new Repo({
      name: 'child',
      relations: {
        mother: {
          type: 'belongsToOne',
          repo: 'mother',
          key: 'motherId',
          alias: 'mother',
          autoPopulate: true,
        },
      },
    }) as Repo<Person>
    childRepo.dataSource = dataSource
    childRepo.repos.mother = motherRepo
    motherRepo.repos.child = childRepo

    var doc = await motherRepo.findOne()
    expect(doc.name).toBe('Alison')
    expect(doc.children[0].name).toBe('Kevin')
    expect(doc.children[0].mother?.name).toBe('Alison')
    expect(doc.children[0].mother?.children[0].name).toBe('Kevin')
    expect(doc.children[0].mother?.children[0].mother).toBeUndefined()
  })
  it('should load relation by performing one query per document if limit option was specified', async () => {
    class Person {
      _id: string
      name: string
      mother?: Mother
      constructor() {
        this._id = ''
        this.name = ''
      }
    }
    class Mother {
      _id: string
      name: string
      children: Person[]
      constructor() {
        this._id = ''
        this.name = ''
        this.children = []
      }
    }

    var data = {
      mother: [
        { _id: '1', name: 'Alison' },
        { _id: '2', name: 'Gina' },
      ],
      child: [
        { _id: '1', motherId: '1', name: 'Kevin' },
        { _id: '2', motherId: '1', name: 'Lisa' },
        { _id: '3', motherId: '1', name: 'Claire' },
        { _id: '4', motherId: '2', name: 'Ian' },
        { _id: '5', motherId: '2', name: 'Brenda' },
        { _id: '6', motherId: '2', name: 'Alison' },
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
          autoPopulate: true,
        },
      },
    }) as Repo<Mother>
    motherRepo.dataSource = dataSource

    var childRepo = new Repo({
      name: 'child',
      relations: {
        mother: {
          type: 'belongsToOne',
          repo: 'mother',
          key: 'motherId',
          alias: 'mother',
          autoPopulate: false,
        },
      },
    })
    childRepo.dataSource = dataSource
    childRepo.repos.mother = motherRepo
    motherRepo.repos.child = childRepo

    var doc = await motherRepo.findOne()
    // Query count should be 2
    // - 1 for the initial find query and then 1 for populating relation
    expect(dataSource.queryCount).toBe(2)
    expect(doc?.children.length).toBe(1)
  })
})
