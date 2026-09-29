'use strict'

//var ModelManager = require('mzen').default
var ServerRepo = require('mzen/dist/repo').default
var ServerService = require('mzen/dist/service').default
var Server = require('../dist/server').default

var server = new Server({
  model: {
    dataSources: [
      {
        name: 'db',
        type: 'mongodb',
        url: 'mongodb://localhost:27017/domain-model-api-example',
      },
    ],
  },
})

var data = {
  person: [
    {
      _id: '63',
      name: 'Kevin',
      bestFriendId: '89',
      workPlaceId: '1',
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
      workPlaceId: '2',
      contact: {
        address: '5 Marina Tower',
        tel: '133 436 109',
      },
    },
    {
      _id: '97',
      name: 'Sarah',
      bestFriendId: '63',
      workPlaceId: '1',
      contact: {
        address: '93 Alderson Road',
        tel: '093 238 2349',
      },
    },
    {
      _id: '165',
      name: 'Sam',
      bestFriendId: '63',
      workPlaceId: '2',
      contact: {
        address: '502 Tanjung Bungha',
        tel: '078 131 1847',
      },
    },
    {
      _id: '192',
      name: 'Paula',
      bestFriendId: '63',
      workPlaceId: '1',
      contact: {
        address: '101 King Street',
        tel: '555 555 5555',
      },
    },
  ],
  workPlace: [
    { _id: '1', name: 'Hotel', managerId: '89' },
    { _id: '2', name: 'Bar', managerId: '192' },
  ],
}

class Person {
  getName() {
    return this.name + ' (' + this._id + ')'
  }
}

class PersonContact {
  getAddress() {
    return this.address + ' (@)'
  }
}

var personRepo = new ServerRepo({
  name: 'person',
  dataSource: 'db',
  strict: false,
  schema: {
    _id: Number,
    name: { $type: String, $validate: { required: true } },
    bestFriendId: Number,
    workPlaceId: Number,
    created: Date,
    contact: {
      address: String,
      tel: String,
    },
  },
  indexes: {
    bestFriendId: { spec: { bestFriendId: 1 } },
    workPlaceId: { spec: { workPlaceId: 1 } },
  },
  autoIndex: true,
  relations: {
    isConsideredBestFriendBy: {
      type: 'hasMany',
      repo: 'person',
      key: 'bestFriendId',
      sort: ['name', 'asc'],
      autoPopulate: true,
      recursion: 1,
    },
    isConsideredBestFriendByCount: {
      type: 'hasManyCount',
      repo: 'person',
      key: 'bestFriendId',
      sort: ['name', 'asc'],
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
    workPlace: {
      type: 'belongsToOne',
      repo: 'workPlace',
      key: 'workPlaceId',
      autoPopulate: true,
      recursion: 0,
    },
  },
})
personRepo.findByPkey = function (req) {
  return this.findOne({ _id: req.pkey }, { populate: true })
}.bind(personRepo)

server.modelManager.addRepo(personRepo)

var workPlaceRepo = new ServerRepo({
  name: 'workPlace',
  dataSource: 'db',
  schema: {
    _id: Number,
    managerId: Number,
  },
  relations: {
    manager: {
      type: 'belongsToOne',
      repo: 'person',
      key: 'managerId',
      autoPopulate: true,
    },
  },
})
server.modelManager.addRepo(workPlaceRepo)

class ArtistContactService extends ServerService {
  constructor(options) {
    super({
      name: 'artistSignup',
    })
  }
  sendEmail(artistId, artist, query, fromEmail, json) {
    return Promise.resolve(artistId)
  }
}
server.modelManager.addService(new ArtistContactService())

const apiConfigs = [
  {
    repo: 'person',
    enable: true,
    endpointsEnable: { 'get-findByPkey': true },
    acl: {
      rules: [{ allow: true, role: 'all' }],
    },
    endpoints: {
      'get-findByPkey': {
        enable: true,
        path: '/:pkey',
        method: 'findByPkey',
        verbs: ['get', 'head'],
        data: {
          pkey: { src: 'param', type: Number },
        },
        response: {
          success: { http: { code: 200, contentType: 'json' } },
          error: {
            RepoErrorValidation: { http: { code: 403 } },
            ServerErrorRepoNotFound: { http: { code: 404 } },
          },
        },
        acl: {
          rules: [{ allow: true, role: 'all' }],
        },
      },
    },
  },
  {
    repo: 'artist',
    enable: true,
    endpoints: {
      'get-sendEmail': {
        enable: true,
        path: 'sendEmail/:artistId',
        method: 'sendEmail',
        desc: 'Sends an email to the artist',
        verbs: ['get'],
        data: {
          artistId: {
            name: 'artistId',
            type: Number,
            source: 'param',
            desc: 'Artist Id',
          },
        },
        response: {
          desc: 'Response',
          success: {
            http: {
              code: 200,
              //contentType: 'html',
              headers: { ETag: '12345' },
            },
            type: Object,
            schema: { artistId: Number },
          },
          error: {
            CustomError: {
              http: {
                code: 404,
              },
              type: Object,
              schema: {
                test: { $type: Number, $validation: { required: true } },
              },
            },
          },
        },
      },
    },
  },
]

server.addApiConfigs(apiConfigs)
;(async () => {
  try {
    await server.init()
    await server.start()
    await personRepo.deleteMany()
    await workPlaceRepo.deleteMany()
    await personRepo.insertMany(data.person)
    await workPlaceRepo.insertOne(data.workPlace[0])
  } catch (e) {
    console.log(JSON.stringify(e.stack, null, 2))
  }
})()
