'use strict'

var { ModelManager, Repo } = require('../dist/index')

var data = {
  person: [
    {
      _id: '63',
      name: 'Kevin',
      bestFriendId: '89',
      workplaceId: '1',
      contact: {
        address: '123 Picton Road',
        tel: '123 456 789',
      },
      created: new Date(),
    },
    {
      _id: '89',
      name: 'Tom',
      bestFriendId: '63',
      workplaceId: '2',
      contact: {
        address: '5 Marina Tower',
        tel: '133 436 109',
      },
    },
    {
      _id: '97',
      name: 'Sarah',
      bestFriendId: '63',
      workplaceId: '1',
      contact: {
        address: '93 Alderson Road',
        tel: '093 238 2349',
      },
    },
    {
      _id: '165',
      name: 'Sam',
      bestFriendId: '63',
      workplaceId: '2',
      contact: {
        address: '502 Tanjung Bungha',
        tel: '078 131 1847',
      },
    },
    {
      _id: '192',
      name: 'Paula',
      bestFriendId: '63',
      workplaceId: '1',
      contact: {
        address: '101 King Street',
        tel: '555 555 5555',
      },
    },
  ],
  workplace: [
    { _id: '1', name: 'Hotel', managerId: '89' },
    { _id: '2', name: 'Bar', managerId: '192' },
  ],
}

var modelManager = new ModelManager({
  dataSources: [
    {
      name: 'db',
      type: 'mysql',
      config: {
        host: 'localhost',
        user: 'root',
        database: 'mzen',
        password: 'kNnq1ggvONtKSxwY',
      },
    },
  ],
})

class Person {
  constructor(props) {
    Object.assign(this, props)
  }
  getName() {
    return this.name + ' (' + this._id + ')'
  }
}

class PersonContact {
  constructor(props) {
    Object.assign(this, props)
  }
  getAddress() {
    return this.address + ' (@)'
  }
}

var personRepo = new Repo({
  name: 'person',
  dataSource: 'db',
  strict: false,
  schema: {
    $construct: Person,
    _id: Number,
    bestFriendId: Number,
    workplaceId: Number,
    created: Date,
    contact: {
      address: String,
      tel: String,
    },
  },
  indexes: {
    bestFriendId: { spec: { bestFriendId: -1, workplaceId: -1 } },
    workplaceId: { spec: { workplaceId: -1 } },
  },
  autoIndex: true,
  relations: {
    isConsideredBestFriendByCount: {
      type: 'hasManyCount',
      repo: 'person',
      key: 'bestFriendId',
      sort: { name: 1 },
      autoPopulate: true,
    },
    isConsideredBestFriendBy: {
      type: 'hasMany',
      repo: 'person',
      key: 'bestFriendId',
      sort: { name: 1 },
      autoPopulate: true,
      recursion: 0,
    },
    bestFriend: {
      type: 'belongsToOne',
      repo: 'person',
      key: 'bestFriendId',
      autoPopulate: true,
      recursion: 0,
    },
    workplace: {
      type: 'belongsToOne',
      repo: 'workplace',
      key: 'workplaceId',
      autoPopulate: true,
      fields: { name: 0 },
      recursion: 0,
    },
  },
})
modelManager.addRepo(personRepo)

var workplaceRepo = new Repo({
  name: 'workplace',
  dataSource: 'db',
  schema: {
    $construct: PersonContact,
    _id: Number,
    managerId: Number,
  },
  relations: {
    manager: {
      type: 'belongsToOne',
      repo: 'person',
      key: 'managerId',
      autoPopulate: true,
      recursion: 0,
    },
  },
})
modelManager.addRepo(workplaceRepo)
;(async () => {
  try {
    await modelManager.init()
    console.log('** Connected **')

    await personRepo.deleteMany()
    await workplaceRepo.deleteMany()
    await personRepo.insertMany(data.person)
    await workplaceRepo.insertOne(data.workplace[0])
    await personRepo.updateMany(
      { workplaceId: 1 },
      { $set: { 'contact.address': '123 Updated Street' } }
    )
    var people = await personRepo.find({}, { sort: { name: 1 } })

    console.log(JSON.stringify(people, null, 2))

    await modelManager.shutdown()
    console.log('** Disconnected **')
  } catch (e) {
    console.log(JSON.stringify(e, null, 2))
  }
})()
