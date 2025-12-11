import Schema from 'schema'
import Collection from 'collection'

class ConstructorTestUsers extends Array {
  static alias: string
  static fromArray(data) {
    return new ConstructorTestUsers(...data)
  }
}
ConstructorTestUsers.alias = 'ConstructorTestUsers'

class ConstructorTestUser {
  static alias: string
  _id?: string
  nameFirst?: string
  nameLast?: string
  address?: ConstructorTestAddress

  constructor(data: any) {
    this._id = data?._id
    this.nameFirst = data?.nameFirst
    this.nameLast = data?.nameLast
    this.address = data?.address
      ? new ConstructorTestAddress(data.address)
      : undefined
  }

  getName() {
    return this.nameFirst + ' ' + this.nameLast
  }
}
ConstructorTestUser.alias = 'ConstructorTestUser'

class ConstructorTestAddress {
  static alias: string
  userId?: string
  street?: string
  postcode?: string

  constructor(data: any) {
    this.userId = data?.userId
    this.street = data?.street
    this.postcode = data?.postcode
  }

  getStreet() {
    return this.street
  }
}
ConstructorTestAddress.alias = 'ConstructorTestAddress'

class ConstructorTestBike {
  static alias: string
  numWheels: number

  constructor(data: any) {
    this.numWheels = data?.numWheels
  }

  getNumWheels() {
    return this.numWheels
  }
}
ConstructorTestBike.alias = 'Bicycle'

describe('applyTransients', () => {
  it('should apply $construct function to the root object', () => {
    let object = { nameFirst: 'John', nameLast: 'Smith' } as ConstructorTestUser

    const schema = new Schema(
      {
        $construct: ConstructorTestUser,
        nameFirst: String,
        nameLast: String,
      },
      {
        constructors: [ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.constructor).toBe(ConstructorTestUser)
    expect(object.getName()).toBe('John Smith')
  })

  it('should apply $construct function to the root object via constructorName', () => {
    let object = { numWheels: 2 } as ConstructorTestBike

    const schema = new Schema(
      {
        $construct: 'Bicycle',
        numWheels: Number,
      },
      {
        constructors: [ConstructorTestBike],
      }
    )

    object = schema.applyTransients(object)
    expect(object.constructor).toBe(ConstructorTestBike)
    expect(object.getNumWheels()).toBe(2)
  })

  it('should apply $construct function to the embedded objects', () => {
    let object = {
      userMostPopular: {
        nameFirst: 'John',
        nameLast: 'Smith',
      } as ConstructorTestUser,
      userLeastPopular: {
        nameFirst: 'Tom',
        nameLast: 'Jones',
      } as ConstructorTestUser,
    }

    const schema = new Schema(
      {
        userMostPopular: {
          $construct: ConstructorTestUser,
          nameFirst: 'John',
          nameLast: 'Smith',
        },
        userLeastPopular: {
          $construct: ConstructorTestUser,
          nameFirst: 'Tom',
          nameLast: 'Jones',
        },
      },
      {
        constructors: [ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.userMostPopular.constructor).toBe(ConstructorTestUser)
    expect(object.userMostPopular.getName()).toBe('John Smith')
    expect(object.userLeastPopular.constructor).toBe(ConstructorTestUser)
    expect(object.userLeastPopular.getName()).toBe('Tom Jones')
  })

  it('should apply $construct function to the root object as referenced by constrcutor name', () => {
    let object = { nameFirst: 'John', nameLast: 'Smith' } as ConstructorTestUser

    const schema = new Schema(
      {
        $construct: 'ConstructorTestUser',
        nameFirst: String,
        nameLast: String,
      },
      {
        constructors: [ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.constructor).toBe(ConstructorTestUser)
    expect(object.getName()).toBe('John Smith')
  })

  it('should apply $construct function to the embedded objects as referenced by constrcutor name', () => {
    let object = {
      userMostPopular: {
        nameFirst: 'John',
        nameLast: 'Smith',
      } as ConstructorTestUser,
      userLeastPopular: {
        nameFirst: 'Tom',
        nameLast: 'Jones',
      } as ConstructorTestUser,
    }

    const schema = new Schema(
      {
        userMostPopular: {
          $construct: 'ConstructorTestUser',
          nameFirst: 'John',
          nameLast: 'Smith',
        },
        userLeastPopular: {
          $construct: 'ConstructorTestUser',
          nameFirst: 'Tom',
          nameLast: 'Jones',
        },
      },
      {
        constructors: [ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.userMostPopular.constructor).toBe(ConstructorTestUser)
    expect(object.userMostPopular.getName()).toBe('John Smith')
    expect(object.userLeastPopular.constructor).toBe(ConstructorTestUser)
    expect(object.userLeastPopular.getName()).toBe('Tom Jones')
  })

  it('should apply $construct function according to array spec', () => {
    let object = {
      users: [
        { nameFirst: 'John', nameLast: 'Smith' } as ConstructorTestUser,
        { nameFirst: 'Tom', nameLast: 'Jones' } as ConstructorTestUser,
      ],
    }

    const schema = new Schema(
      {
        users: [
          {
            $construct: 'ConstructorTestUser',
            nameFirst: String,
            nameLast: String,
          },
        ],
      },
      {
        constructors: [ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.users[0].constructor).toBe(ConstructorTestUser)
    expect(object.users[0].getName()).toBe('John Smith')
    expect(object.users[1].constructor).toBe(ConstructorTestUser)
    expect(object.users[1].getName()).toBe('Tom Jones')
  })

  it('should apply $construct function according to array spec object', () => {
    let object = {
      users: [
        { nameFirst: 'John', nameLast: 'Smith' } as ConstructorTestUser,
        { nameFirst: 'Tom', nameLast: 'Jones' } as ConstructorTestUser,
      ],
    }

    const schema = new Schema(
      {
        users: {
          $type: Array,
          $spec: {
            $construct: 'ConstructorTestUser',
            nameFirst: String,
            nameLast: String,
          },
        },
      },
      {
        constructors: [ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.users[0].constructor).toBe(ConstructorTestUser)
    expect(object.users[0].getName()).toBe('John Smith')
    expect(object.users[1].constructor).toBe(ConstructorTestUser)
    expect(object.users[1].getName()).toBe('Tom Jones')
  })

  it('should apply $construct function to array value according to array spec object', () => {
    let object = {
      users: [
        { nameFirst: 'John', nameLast: 'Smith' } as ConstructorTestUser,
        { nameFirst: 'Tom', nameLast: 'Jones' } as ConstructorTestUser,
      ],
    }

    const schema = new Schema(
      {
        users: {
          $type: Array,
          $construct: 'ConstructorTestUsers',
          $spec: {
            $construct: 'ConstructorTestUser',
            nameFirst: String,
            nameLast: String,
          },
        },
      },
      {
        constructors: [ConstructorTestUsers, ConstructorTestUser],
      }
    )

    object = schema.applyTransients(object)
    expect(object.users.constructor).toBe(ConstructorTestUsers)
    expect(Array.isArray(object.users)).toBe(true)
    expect(object.users[0].getName()).toBe('John Smith')
    expect(object.users[1].getName()).toBe('Tom Jones')
  })

  it('should apply $construct function to schemaRelation', () => {
    let object = {
      nameFirst: 'John',
      nameLast: 'Smith',
      address: { street: 'Picton Road' },
    } as ConstructorTestUser

    const schemaAddress = new Schema({
      $name: 'address',
      $construct: ConstructorTestAddress,
      street: { $type: 'String', $validate: { notNull: true } },
    })

    const schema = new Schema({
      $construct: ConstructorTestUser,
      nameFirst: String,
      nameLast: String,
      address: { $schema: 'address', $relation: true },
    })
    schema.addConstructor(ConstructorTestUser)
    schema.addConstructor(ConstructorTestAddress)
    schema.addSchema(schemaAddress)

    object = schema.applyTransients(object)
    expect(object.constructor).toBe(ConstructorTestUser)
    expect(object.getName()).toBe('John Smith')
    expect(object.address.constructor).toBe(ConstructorTestAddress)
    expect(object.address.getStreet()).toBe('Picton Road')
  })

  it('should typecast date values', () => {
    let object = {
      created: '2018-01-01T00:00:00.000Z',
      updated: '2018-01-01T00:00:00.000Z',
    }

    const schema = new Schema({
      $name: 'record',
      created: Date,
      updated: Date,
    })

    object = schema.applyTransients(object)
    expect(object.created.constructor).toBe(Date)
    expect(object.updated.constructor).toBe(Date)
  })

  it('should pass through date values', () => {
    let object = {
      created: new Date('2018-01-01T00:00:00.000Z'),
      updated: new Date('2018-01-01T00:00:00.000Z'),
    }

    const schema = new Schema({
      $name: 'record',
      created: { $type: Date },
      updated: { $type: Date },
    })

    object = schema.applyTransients(object)
    expect(object.created.constructor).toBe(Date)
    expect(object.updated.constructor).toBe(Date)
  })

  it('should typecast number values', () => {
    let object = {
      age: '37',
    }

    const schema = new Schema({
      $name: 'record',
      age: Number,
    })

    object = schema.applyTransients(object)
    expect(object.age.constructor).toBe(Number)
  })

  it('should apply $pathRef value', () => {
    let user = {
      _id: '123',
      address: {
        postcode: 'L1',
      },
    } as ConstructorTestUser

    const schema = new Schema({
      _id: 'String',
      address: {
        userId: { $pathRef: '_id' },
        postcode: 'L1',
      },
    })

    user = schema.applyTransients(user)
    expect(user.address.userId).toBe('123')
  })

  it('should apply $pathRef value deep', () => {
    let user = {
      _id: '123',
      address: {
        postcode: 'L1',
      },
    } as any

    const schema = new Schema({
      _id: 'String',
      a: {
        b: {
          c: {
            userId: { $pathRef: '_id' },
          },
        },
      },
    })

    user = schema.applyTransients(user)
    expect(user.a.b.c.userId).toBe('123')
  })
})

describe('stripTransients', () => {
  it('should strip $pathRef value', () => {
    let user = {
      _id: '123',
      address: {
        postcode: 'L1',
      },
    } as ConstructorTestUser

    const schema = new Schema({
      _id: 'String',
      address: {
        userId: { $pathRef: '_id' },
        postcode: 'L1',
      },
    })

    user = schema.applyTransients(user)
    expect(user.address.userId).toBe('123')
    user = schema.stripTransients(user)
    expect(user.address.userId).toBeUndefined()
  })

  it('should strip $pathRef value deep', () => {
    let user = {
      _id: '123',
      address: {
        postcode: 'L1',
      },
    } as any

    const schema = new Schema({
      _id: 'String',
      a: {
        b: {
          c: {
            userId: { $pathRef: '_id' },
          },
        },
      },
    })

    user = schema.applyTransients(user)
    expect(user.a.b.c.userId).toBe('123')
    user = schema.stripTransients(user)
    expect(user.a.b.c.userId).toBeUndefined()
  })

  it('should strip $relation value', () => {
    let user = {
      _id: '123',
      address: {
        postcode: 'L1',
      },
    } as any

    const schema = new Schema({
      _id: 'String',
      address: { $relation: true },
    })

    expect(user.address.postcode).toBe('L1')
    user = schema.stripTransients(user)
    expect(user.address).toBeUndefined()
  })

  it('should strip $relation value deep', () => {
    let user = {
      _id: '123',
      a: {
        b: {
          c: {
            userId: '123',
          },
        },
      },
    } as any

    const schema = new Schema({
      _id: 'String',
      a: {
        b: {
          c: {
            $relation: true,
            userId: 'String',
          },
        },
      },
    })

    user = schema.applyTransients(user)
    expect(user.a.b.c.userId).toBe('123')
    user = schema.stripTransients(user)
    expect(user.a.b.c).toBeUndefined()
  })

  it('should strip tranients from paths using iteratePaths', () => {
    let user = {
      a: {
        b: {
          c: {
            userId: '123',
          },
        },
      },
    } as any

    const schema = new Schema({
      _id: 'String',
      address: { street: String, postcode: String },
      accounts: {
        $type: Array,
        $relation: true,
      },
      a: {
        b: {
          c: {
            $relation: true,
            userId: 'String',
          },
        },
      },
    })

    expect(user.a.b.c.userId).toBe('123')
    user = schema.stripTransients(user, 'iteratePaths')
    expect(user.a.b.c).toBeUndefined()
  })
})

describe('stripFunctions', () => {
  it('should strip functions from objects', () => {
    let user = {
      _id: '123',
      name: 'John Doe',
      getFullName: function () {
        return this.name
      },
      address: {
        street: 'Main St',
        getStreet: function () {
          return this.street
        },
      },
      hobbies: [
        'reading',
        function () {
          return 'coding'
        },
      ],
    } as any

    const schema = new Schema({
      _id: 'String',
      name: 'String',
      address: {
        street: 'String',
      },
      hobbies: ['String'],
    })

    user = schema.stripFunctions(user)

    expect(user._id).toBe('123')
    expect(user.name).toBe('John Doe')
    expect(user.getFullName).toBeUndefined()
    expect(user.address.street).toBe('Main St')
    expect(user.address.getStreet).toBeUndefined()
    expect(user.hobbies).toEqual(['reading'])
  })
  it('should apply default collection when applying constructors to an array', () => {
    let collectionData = [
      { nameFirst: 'John', nameLast: 'Smith' },
      { nameFirst: 'Tom', nameLast: 'Jones' },
    ]
    const schema = new Schema({
      nameFirst: String,
      nameLast: String,
    })

    const result = schema.applyTransients(
      collectionData
    ) as ConstructorTestUsers
    expect(result.constructor).toBe(Collection)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
  })
  it('should apply $constructCollection when applying constructors to an array', () => {
    let collectionData = [
      { nameFirst: 'John', nameLast: 'Smith' },
      { nameFirst: 'Tom', nameLast: 'Jones' },
    ]
    const schema = new Schema(
      {
        $constructCollection: 'ConstructorTestUsers',
        $construct: 'ConstructorTestUser',
        nameFirst: String,
        nameLast: String,
      },
      {
        constructors: [ConstructorTestUsers, ConstructorTestUser],
      }
    )

    const result = schema.applyTransients(
      collectionData
    ) as ConstructorTestUsers
    expect(result.constructor).toBe(ConstructorTestUsers)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].constructor).toBe(ConstructorTestUser)
    expect(result[1].constructor).toBe(ConstructorTestUser)
    expect(result[0].getName()).toBe('John Smith')
    expect(result[1].getName()).toBe('Tom Jones')
    expect(result.length).toBe(2)
  })
  it('should apply $constructCollection when applying constructors to an empty array', () => {
    let collectionData = []
    const schema = new Schema(
      {
        $constructCollection: 'ConstructorTestUsers',
        $construct: 'ConstructorTestUser',
        nameFirst: String,
        nameLast: String,
      },
      {
        constructors: [ConstructorTestUsers, ConstructorTestUser],
      }
    )

    const result = schema.applyTransients(
      collectionData
    ) as ConstructorTestUsers
    expect(result.constructor).toBe(ConstructorTestUsers)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})
