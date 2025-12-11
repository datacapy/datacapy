import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('constructor', function () {
  it('should return entity objects if constructor specified in repo schema', async () => {
    class User {
      name_first: string
      name_last: string
      constructor() {
        this.name_first = ''
        this.name_last = ''
      }
      getFullname() {
        return this.name_first + ' ' + this.name_last
      }
    }

    var data = {
      user: [
        { _id: '1', name_first: 'Kevin', name_last: 'Foster' },
        { _id: '2', name_first: 'Tom', name_last: 'Murphy' },
      ],
    }

    var user = new Repo({
      name: 'user',
      schema: { $construct: 'User' },
      constructors: [User],
    }) as Repo<User>
    user.dataSource = new MockDataSource(data)

    var docs = await user.find()
    expect(typeof docs[0].getFullname).toBe('function')
    expect(docs[0].getFullname()).toBe('Kevin Foster')
    expect(docs[1].getFullname()).toBe('Tom Murphy')
  })
  it('should return entity objects if constructor specified in relation repo schema', async () => {
    class Timezone {
      name: string
      constructor() {
        this.name = ''
      }
      getName() {
        return this.name
      }
    }
    class User {
      name_first: string
      name_last: string
      userTimezone?: Timezone
      constructor() {
        this.name_first = ''
        this.name_last = ''
      }
      getFullname() {
        return this.name_first + ' ' + this.name_last
      }
    }

    var data = {
      userTimezone: [{ _id: '1', name: 'Europe/London' }],
      user: [{ _id: '1', name: 'Kevin Foster', timeZoneId: '1' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'userTimezone',
          key: 'timeZoneId',
          alias: 'userTimezone',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    userRepo.dataSource = dataSource

    var userTimezoneRepo = new Repo({
      name: 'userTimezone',
      schema: { $construct: 'Timezone' },
      constructors: [Timezone],
    })
    userTimezoneRepo.dataSource = dataSource
    userRepo.repos.userTimezone = userTimezoneRepo

    var docs = await userRepo.find()
    expect(typeof docs[0].userTimezone?.getName).toBe('function')
    expect(docs[0].userTimezone?.getName()).toBe('Europe/London')
  })
  it('should return entity objects if constructor specified by relation of relation schema', async () => {
    class Country {
      name: string
      constructor() {
        this.name = ''
      }
      getName() {
        return this.name + ' Country'
      }
    }
    class Timezone {
      name: string
      country?: Country
      constructor() {
        this.name = ''
      }
      getName() {
        return this.name
      }
    }
    class User {
      name_first: string
      name_last: string
      timezone?: Timezone
      constructor() {
        this.name_first = ''
        this.name_last = ''
      }
      getFullname() {
        return this.name_first + ' ' + this.name_last
      }
    }

    var data = {
      country: [{ _id: '1', name: 'United Kingdom' }],
      timezone: [{ _id: '1', name: 'Europe/London', countryId: '1' }],
      user: [{ _id: '1', name: 'Kevin Foster', timeZoneId: '1' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      relations: {
        userTimezone: {
          type: 'belongsToOne',
          repo: 'timezone',
          key: 'timeZoneId',
          alias: 'timezone',
          autoPopulate: true,
        },
      },
    }) as Repo<User>
    userRepo.dataSource = dataSource

    var timezoneRepo = new Repo({
      name: 'timezone',
      relations: {
        country: {
          type: 'belongsToOne',
          repo: 'country',
          key: 'countryId',
          alias: 'country',
          autoPopulate: true,
        },
      },
    }) as Repo<Timezone>
    timezoneRepo.dataSource = dataSource
    userRepo.repos.timezone = timezoneRepo

    var countryRepo = new Repo({
      name: 'country',
      schema: { $construct: 'Country' },
      constructors: [Country],
    })
    countryRepo.dataSource = dataSource
    timezoneRepo.repos.country = countryRepo
    userRepo.repos.country = countryRepo

    var docs = await userRepo.find()
    expect(typeof docs[0].timezone?.country?.getName).toBe('function')
    expect(docs[0].timezone?.country?.getName()).toBe('United Kingdom Country')
  })
  it('should return embedded entity objects if embedded constructor specified in repo schema', async () => {
    class Contact {
      address: string
      constructor() {
        this.address = ''
      }
      getAddress() {
        return this.address + ' (@)'
      }
    }
    class User {
      name_first: string
      name_last: string
      contact?: Contact
      constructor() {
        this.name_first = ''
        this.name_last = ''
      }
      getFullname() {
        return this.name_first + ' ' + this.name_last
      }
    }

    var data = {
      user: [
        {
          _id: '1',
          name_first: 'Kevin',
          name_last: 'Foster',
          contact: {
            address: '123 Picton Road',
            tel: '123 456 789',
          },
        },
        {
          _id: '2',
          name_first: 'Tom',
          name_last: 'Murphy',
          contact: {
            address: '5 Marina Tower',
            tel: '133 436 109',
          },
        },
      ],
    }

    var user = new Repo({
      name: 'user',
      schema: {
        contact: { $construct: 'Contact' },
      },
      constructors: [Contact],
    }) as Repo<User>
    user.dataSource = new MockDataSource(data)

    var docs = await user.find()
    expect(typeof docs[0].contact?.getAddress).toBe('function')
    expect(docs[0].contact?.getAddress()).toBe('123 Picton Road (@)')
    expect(docs[1].contact?.getAddress()).toBe('5 Marina Tower (@)')
  })
  it('should return deep embedded entity objects if embedded constructor specified in repo schema', async () => {
    class Contact {
      address: string
      constructor() {
        this.address = ''
      }
      getAddress() {
        return this.address + ' (@)'
      }
    }
    class User {
      name_first: string
      name_last: string
      contact?: Contact
      constructor() {
        this.name_first = ''
        this.name_last = ''
      }
      getFullname() {
        return this.name_first + ' ' + this.name_last
      }
    }
    class Website {
      name_first: string
      users: User[]
      constructor() {
        this.name_first = ''
        this.users = []
      }
    }

    var data = {
      website: [
        {
          _id: '1',
          name: 'Google',
          users: [
            {
              _id: '1',
              name_first: 'Kevin',
              name_last: 'Foster',
              contact: {
                address: '123 Picton Road',
                tel: '123 456 789',
              },
            },
            {
              _id: '2',
              name_first: 'Tom',
              name_last: 'Murphy',
              contact: {
                address: '5 Marina Tower',
                tel: '133 436 109',
              },
            },
          ],
        },
      ],
    }

    var website = new Repo({
      name: 'website',
      schema: {
        users: [
          {
            contact: { $construct: 'Contact' },
          },
        ],
      },
      constructors: [Contact],
    }) as Repo<Website>
    website.dataSource = new MockDataSource(data)

    var docs = await website.find()
    expect(typeof docs[0].users[0].contact?.getAddress).toBe('function')
    expect(docs[0].users[0].contact?.getAddress()).toBe('123 Picton Road (@)')
    expect(docs[0].users[1].contact?.getAddress()).toBe('5 Marina Tower (@)')
  })
})
