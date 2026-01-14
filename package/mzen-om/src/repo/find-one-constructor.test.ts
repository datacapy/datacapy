import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('constructor', function () {
  it('should return entity objects if constructor specified in repo schema', async () => {
    class User {
      name_first?: string
      name_last?: string
      constructor(data: any) {
        this.name_first = data?.name_first
        this.name_last = data?.name_last
      }
      getFullname() {
        return this.name_first + ' ' + this.name_last
      }
    }

    var data = {
      user: [{ _id: '1', name_first: 'Kevin', name_last: 'Foster' }],
    }

    var userRepo = new Repo({
      name: 'user',
      schema: { $construct: 'User' },
      constructors: [User],
    }) as Repo<User>
    userRepo.dataSource = new MockDataSource(data)

    var doc = await userRepo.findOne()
    expect(doc?.getFullname()).toBe('Kevin Foster')
  })
  it('should return entity objects if constructor specified in relation repo schema', async () => {
    class Timezone {
      _id?: string
      userId?: string
      name?: string
      constructor(data: any) {
        this._id = data?._id
        this.userId = data?.userId
        this.name = data?.name
      }
      getName() {
        return this.name
      }
    }
    class User {
      _id?: string
      name?: string
      userTimezone?: Timezone
      constructor(data: any) {
        this._id = data?._id
        this.name = data?.name
        this.userTimezone = data?.userTimezone
          ? new Timezone(data.userTimezone)
          : undefined
      }
    }

    var data = {
      userTimezone: [{ _id: '1', userId: '1', name: 'Europe/London' }],
      user: [{ _id: '1', name: 'Kevin Foster' }],
    }
    var dataSource = new MockDataSource(data)

    var userRepo = new Repo({
      name: 'user',
      schema: { $construct: 'User' },
      constructors: [User, Timezone],
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
    userRepo.dataSource = dataSource

    var userTimezoneRepo = new Repo({
      name: 'userTimezone',
      schema: { $construct: 'Timezone' },
      constructors: [User, Timezone],
    }) as Repo<Timezone>
    userTimezoneRepo.dataSource = dataSource
    userRepo.repos.userTimezone = userTimezoneRepo

    var doc = await userRepo.findOne()
    expect(typeof doc?.userTimezone?.getName).toBe('function')
    expect(doc?.userTimezone?.getName()).toBe('Europe/London')
  })
  it('should return entity objects if constructor specified by relation of relation schema', async () => {
    class Country {
      _id?: string
      name?: string
      constructor(data: any) {
        this._id = data?._id
        this.name = data?.name
      }
      getName() {
        return this.name + ' Country'
      }
    }
    class Timezone {
      _id?: string
      name?: string
      countryId?: string
      country?: Country
      constructor(data: any) {
        this._id = data?._id
        this.name = data?.name
        this.countryId = data?.countryId
        this.country = data?.country ? new Country(data.country) : undefined
      }
      getName() {
        return this.name
      }
    }
    class User {
      _id?: string
      name?: string
      timeZoneId?: string
      timezone?: Timezone
      constructor(data: any) {
        this._id = data?._id
        this.name = data?.name
        this.timeZoneId = data?.timeZoneId
        this.timezone = data?.timezone ? new Timezone(data.timezone) : undefined
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
      schema: { $construct: 'User' },
      constructors: [User],
      relations: {
        timezone: {
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
      schema: { $construct: 'Timezone' },
      constructors: [Timezone],
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

    var doc = await userRepo.findOne()
    expect(typeof doc?.timezone?.country?.getName).toBe('function')
    expect(doc?.timezone?.country?.getName()).toBe('United Kingdom Country')
  })
  it('should return embedded entity when embedded constructor specified in repo schema', async () => {
    class Contact {
      address?: string
      tel?: string
      constructor(data: any) {
        this.address = data?.address
        this.tel = data?.tel
      }
      getAddress() {
        return this.address + ' (@)'
      }
    }
    class User {
      _id?: string
      name_first?: string
      name_last?: string
      contact?: Contact
      constructor(data: any) {
        this._id = data?._id
        this.name_first = data?.name_first
        this.name_last = data?.name_last
        this.contact = data?.contact ? new Contact(data.contact) : undefined
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
      ],
    }

    var user = new Repo({
      name: 'user',
      schema: {
        $construct: 'User',
        contact: { $construct: 'Contact' },
      },
      constructors: [User, Contact],
    }) as Repo<User>
    user.dataSource = new MockDataSource(data)

    var doc = await user.findOne()
    expect(typeof doc?.contact?.getAddress).toBe('function')
    expect(doc?.contact?.getAddress()).toBe('123 Picton Road (@)')
  })
  it('should return deep embedded entity when embedded constructor specified in repo schema', async () => {
    class Contact {
      address: string
      tel?: string
      constructor(data: any) {
        this.address = data?.address || ''
        this.tel = data?.tel
      }
      getAddress() {
        return this.address + ' (@)'
      }
    }
    class User {
      _id?: string
      name_first: string
      name_last: string
      contact: Contact

      constructor(data: any) {
        this._id = data?._id
        this.name_first = data?.name_first || ''
        this.name_last = data?.name_last || ''
        this.contact = new Contact(data?.contact)
      }
    }
    class Website {
      _id?: string
      name?: string
      users: User[]

      constructor(data: any) {
        this._id = data?._id
        this.name = data?.name
        this.users = (data?.users || []).map(
          (userData: any) => new User(userData)
        )
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
        $construct: 'Website',
        users: [
          {
            $construct: 'User',
            contact: { $construct: 'Contact' },
          },
        ],
      },
      constructors: [Website, User, Contact],
    }) as Repo<Website>
    website.dataSource = new MockDataSource(data)

    var doc = await website.findOne()
    expect(typeof doc?.users[0].contact.getAddress).toBe('function')
    expect(doc?.users[0].contact.getAddress()).toBe('123 Picton Road (@)')
  })
})
