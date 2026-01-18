import Schema from 'schema'
import SchemaTypes from 'types'

describe('type cast', function () {
  it('should cast String to Number', async () => {
    const data = { age: '33', pi: '3.14159265359' }

    const schema = new Schema({
      age: Number,
      pi: Number,
    })

    await schema.validate(data)
    expect(data.age).toBe(33)
    expect(data.pi).toBe(3.14159265359)
  })
  it('should cast Boolean to Number', async () => {
    const data = {
      isVegetarian: false,
      isNotVegetarian: true,
    }

    const schema = new Schema({
      isVegetarian: Number,
      isNotVegetarian: Number,
    })

    await schema.validate(data)
    expect(data.isVegetarian).toBe(0)
    expect(data.isNotVegetarian).toBe(1)
  })
  it('should cast Number to String', async () => {
    const data = {
      likesCats: 1,
      likesCatsMoreThanDogs: 0,
      likesCakes: 1279,
      doesNotLikeCakes: -1235,
    }

    const schema = new Schema({
      likesCats: String,
      likesCatsMoreThanDogs: String,
      likesCakes: String,
      doesNotLikeCakes: String,
    })

    await schema.validate(data)
    expect(data.likesCats).toBe('1')
    expect(data.likesCatsMoreThanDogs).toBe('0')
    expect(data.likesCakes).toBe('1279')
    expect(data.doesNotLikeCakes).toBe('-1235')
  })
  it('should cast Boolean to String', async () => {
    const data = {
      isVegetarian: false,
      isNotVegetarian: true,
    }

    const schema = new Schema({
      isVegetarian: String,
      isNotVegetarian: String,
    })

    await schema.validate(data)
    expect(data.isVegetarian).toBe('0')
    expect(data.isNotVegetarian).toBe('1')
  })
  it('should cast ObjectId to String', async () => {
    const data = {
      _id: new SchemaTypes.ObjectID('5832969760e396039ced6082'),
    }

    const schema = new Schema({
      _id: String,
    })

    await schema.validate(data)
    expect(data._id.constructor).toBe(String)
    expect(data._id).toBe('5832969760e396039ced6082')
  })
  it('should cast String to Boolean', async () => {
    const data = {
      isVegetarian: 'false',
      isNotVegetarian: 'true',
      likesDogs: '1',
      likesDogsMoreThanCats: '0',
    }

    const schema = new Schema({
      isVegetarian: Boolean,
      isNotVegetarian: Boolean,
      likesDogs: Boolean,
      likesDogsMoreThanCats: Boolean,
    })

    await schema.validate(data)
    expect(data.isVegetarian).toBe(false)
    expect(data.isNotVegetarian).toBe(true)
    expect(data.likesDogs).toBe(true)
    expect(data.likesDogsMoreThanCats).toBe(false)
  })
  it('should cast Number to Boolean', async () => {
    const data = {
      likesCats: 1,
      likesCatsMoreThanDogs: 0,
      likesCakes: 1279,
      doesNotLikeCakes: -1235,
    }

    const schema = new Schema({
      likesCats: Boolean,
      likesCatsMoreThanDogs: Boolean,
      likesCakes: Boolean,
      doesNotLikeCakes: Boolean,
    })

    await schema.validate(data)
    expect(data.likesCats).toBe(true)
    expect(data.likesCatsMoreThanDogs).toBe(false)
    expect(data.likesCakes).toBe(true)
    expect(data.doesNotLikeCakes).toBe(false)
  })
  it('should cast String to Date', async () => {
    const data = {
      created: '2016-11-19T06:50:08.284Z',
      updated: 'Sat, 19 Nov 2016 06:50:33 GMT',
    }

    const schema = new Schema({
      created: Date,
      updated: Date,
    })

    await schema.validate(data)
    expect(data.created.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'string'
    expect(data.created.toJSON()).toBe('2016-11-19T06:50:08.284Z')
    expect(data.updated.constructor).toBe(Date)
    // @ts-ignore - 'toUTCString' does not exist on type 'string'
    expect(data.updated.toUTCString()).toBe('Sat, 19 Nov 2016 06:50:33 GMT')
  })
  it('should cast empty String to Date at current time', async () => {
    const data = {
      created: '',
    }

    const schema = new Schema({
      created: Date,
    })

    await schema.validate(data)
    const dateForComparison = new Date()
    // Set the time just before now for comparison
    dateForComparison.setSeconds(dateForComparison.getSeconds() - 1)
    expect(data.created.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'string'
    expect(data.created.getTime()).toBeGreaterThan(dateForComparison.getTime())
  })
  it('should cast String "now" to Date at current time', async () => {
    const data = {
      created: 'now',
      updated: 'NOW',
    }

    const schema = new Schema({
      created: Date,
      updated: Date,
    })

    await schema.validate(data)
    const dateForComparison = new Date()
    // Set the time just before now for comparison
    dateForComparison.setSeconds(dateForComparison.getSeconds() - 1)

    expect(data.created.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'string'
    expect(data.created.getTime()).toBeGreaterThan(dateForComparison.getTime())
    expect(data.updated.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'string'
    expect(data.updated.getTime()).toBeGreaterThan(dateForComparison.getTime())
  })
  it('should cast Number to Date', async () => {
    // A date represented as a number is the number of milliseconds since 1 January 1970 00:00:00 UTC, with leap seconds ignored
    // (Unix Epoch but consider that most Unix timestamp functions count in seconds)
    const data = {
      created: 1479538208284,
      updated: 1479538233000,
    }

    const schema = new Schema({
      created: Date,
      updated: Date,
    })

    await schema.validate(data)
    expect(data.created.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'number'
    expect(data.created.toJSON()).toBe('2016-11-19T06:50:08.284Z')
    expect(data.updated.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'number'
    expect(data.updated.toUTCString()).toBe('Sat, 19 Nov 2016 06:50:33 GMT')
  })
  it('should accept Date when casting Date', async () => {
    const data = {
      created: new Date('2016-11-19T06:50:08.284Z'),
      updated: new Date('Sat, 19 Nov 2016 06:50:33 GMT'),
    }

    const schema = new Schema({
      created: { $type: Date },
      updated: { $type: Date },
    })

    await schema.validate(data)
    expect(data.created.constructor).toBe(Date)
    // @ts-ignore - 'getTime' does not exist on type 'string'
    expect(data.created.toJSON()).toBe('2016-11-19T06:50:08.284Z')
    expect(data.updated.constructor).toBe(Date)
    // @ts-ignore - 'toUTCString' does not exist on type 'string'
    expect(data.updated.toUTCString()).toBe('Sat, 19 Nov 2016 06:50:33 GMT')
  })
  it('should cast String to ObjectID', async () => {
    const data = {
      _id: '5832969760e396039ced6082',
    }

    const schema = new Schema({
      _id: SchemaTypes.ObjectID,
    })

    await schema.validate(data)
    expect(data._id.constructor).toBe(SchemaTypes.ObjectID)
    expect(data._id.toString()).toBe('5832969760e396039ced6082')
  })
  it('should cast type specified with String value', async () => {
    const data = {
      _id: '5832969760e396039ced6082',
      name: 123,
      count: '456',
      countArray: ['56', '345', '234'],
      deleted: '0',
      created: 1479717244995, // 2016-11-21T08:34:04.995Z,
      _idB: '5832969760e396039ced6082',
      nameB: 123,
      countB: '456',
      countBArray: ['56', '345', '234'],
      deletedB: '0',
      createdB: 1479717244995, // 2016-11-21T08:34:04.995Z
    }

    const schema = new Schema({
      _id: 'ObjectID',
      name: 'String',
      count: 'Number',
      countArray: ['Number'],
      deleted: 'Boolean',
      created: 'Date',
      _idB: { $type: 'ObjectID' },
      nameB: { $type: 'String' },
      countB: { $type: 'Number' },
      countBArray: [{ $type: 'Number' }],
      deletedB: { $type: 'Boolean' },
      createdB: { $type: 'Date' },
    })

    await schema.validate(data)

    expect(data._id.constructor).toBe(SchemaTypes.ObjectID)
    expect(data._id.toString()).toBe('5832969760e396039ced6082')
    expect(data.name.constructor).toBe(String)
    expect(data.name).toBe('123')
    expect(data.count.constructor).toBe(Number)
    expect(data.count).toBe(456)
    expect(data.countArray[0].constructor).toBe(Number)
    expect(data.countArray).toEqual([56, 345, 234])
    expect(data.deleted.constructor).toBe(Boolean)
    expect(data.deleted).toBe(false)
    expect(data.created.constructor).toBe(Date)
    // @ts-ignore - 'toJSON' does not exist on type 'number'
    expect(data.created.toJSON()).toBe('2016-11-21T08:34:04.995Z')

    expect(data._idB.constructor).toBe(SchemaTypes.ObjectID)
    expect(data._idB.toString()).toBe('5832969760e396039ced6082')
    expect(data.nameB.constructor).toBe(String)
    expect(data.nameB).toBe('123')
    expect(data.countB.constructor).toBe(Number)
    expect(data.countB).toBe(456)
    expect(data.countBArray[0].constructor).toBe(Number)
    expect(data.countBArray).toEqual([56, 345, 234])
    expect(data.deletedB.constructor).toBe(Boolean)
    expect(data.deletedB).toBe(false)
    expect(data.createdB.constructor).toBe(Date)
    // @ts-ignore - 'toJSON' does not exist on type 'number'
    expect(data.createdB.toJSON()).toBe('2016-11-21T08:34:04.995Z')
  })
  it('should cast Array of Objects', async () => {
    const data = [
      { age: '21', pi: '3.14159265359' },
      { age: '33', pi: '3.14159265359' },
    ]

    const schema = new Schema({
      age: Number,
      pi: Number,
    })

    await schema.validate(data)

    expect(data[0].age).toBe(21)
    expect(data[0].pi).toBe(3.14159265359)
    expect(data[1].age).toBe(33)
    expect(data[1].pi).toBe(3.14159265359)
  })
  it('should generate error if failed to cast to Number', async () => {
    const data = { age: 'fifty' }

    const schema = new Schema({
      age: Number,
    })

    const result = await schema.validate(data)

    expect(result.isValid).toBe(false)
    expect(data.age).toBe(NaN)
  })
  it('should cast embedded objects', async () => {
    const data = { house: { bedRooms: '3', discounted: '1' } }

    const schema = new Schema({
      house: {
        bedRooms: Number,
        discounted: Boolean,
      },
    })

    await schema.validate(data)

    expect(data.house.bedRooms).toBe(3)
    expect(data.house.discounted).toBe(true)
  })
  it('should cast array with embedded objects', async () => {
    const data = [
      { house: { bedRooms: '3', discounted: '1' } },
      { house: { bedRooms: '2', discounted: '0' } },
    ]

    const schema = new Schema({
      house: {
        bedRooms: Number,
        discounted: Boolean,
      },
    })

    await schema.validate(data)

    expect(data[0].house.bedRooms).toBe(3)
    expect(data[0].house.discounted).toBe(true)
    expect(data[1].house.bedRooms).toBe(2)
    expect(data[1].house.discounted).toBe(false)
  })
  it('should cast embedded array of Number', async () => {
    const data = { hotel: { roomsNumbers: ['200', '212', '302'] } }

    const schema = new Schema({
      hotel: {
        roomsNumbers: [Number],
      },
    })

    await schema.validate(data)

    expect(data.hotel.roomsNumbers[0]).toBe(200)
    expect(data.hotel.roomsNumbers[1]).toBe(212)
    expect(data.hotel.roomsNumbers[2]).toBe(302)
  })
  it('should cast embedded array of objects', async () => {
    const data = {
      house: {
        rooms: [
          { name: 'bedroom', sleepHere: '1' },
          { name: 'kitchen', sleepHere: '0' },
          { name: 'bathroom', sleepHere: '0' },
        ],
      },
    }

    const schema = new Schema({
      house: {
        rooms: [
          {
            name: String,
            sleepHere: Boolean,
          },
        ],
      },
    })

    await schema.validate(data)

    expect(data.house.rooms[0].sleepHere).toBe(true)
    expect(data.house.rooms[1].sleepHere).toBe(false)
    expect(data.house.rooms[2].sleepHere).toBe(false)
  })
  it('should cast embedded array of arrays', async () => {
    const data = {
      house: {
        rooms: [
          [
            { name: 'bedroom', sleepHere: '1' },
            { name: 'kitchen', sleepHere: '0' },
          ],
          [{ name: 'bathroom', sleepHere: '0' }],
        ],
      },
    }

    const schema = new Schema({
      house: {
        rooms: [
          [
            {
              name: String,
              sleepHere: Boolean,
            },
          ],
        ],
      },
    })

    await schema.validate(data)

    expect(data.house.rooms[0][0].sleepHere).toBe(true)
    expect(data.house.rooms[0][1].sleepHere).toBe(false)
    expect(data.house.rooms[1][0].sleepHere).toBe(false)
  })
  it('should cast match-all fields', async () => {
    const data = {
      field1: '21',
      field2: '3.14159265359',
      field3: '0',
    }

    const schema = new Schema({
      '*': { $type: Number },
    })

    await schema.validate(data)

    expect(data.field1).toBe(21)
    expect(data.field2).toBe(3.14159265359)
    expect(data.field3).toBe(0)
  })
  it('should cast match-all fields in strict mode', async () => {
    const data = {
      field1: '21',
      field2: '3.14159265359',
      field3: '0',
    }

    const schema = new Schema({
      '$strict': true,
      '*': { $type: Number },
    })

    await schema.validate(data)

    expect(data.field1).toBe(21)
    expect(data.field2).toBe(3.14159265359)
    expect(data.field3).toBe(0)
  })
  it('should cast nested match-all fields', async () => {
    const data = {
      name: 'John Doe',
      numbers: {
        field1: '21',
        field2: '3.14159265359',
        field3: '0',
      },
    }

    const schema = new Schema({
      $strict: true,
      name: String,
      numbers: {
        '*': { $type: Number },
      },
    })

    await schema.validate(data)

    expect(data.numbers.field1).toBe(21)
    expect(data.numbers.field2).toBe(3.14159265359)
    expect(data.numbers.field3).toBe(0)
  })
  it('should cast nested match-all fields in strict mode', async () => {
    const data = {
      name: 'John Doe',
      numbers: {
        field1: '21',
        field2: '3.14159265359',
        field3: '0',
      },
    }

    const schema = new Schema({
      $strict: true,
      name: String,
      numbers: {
        '*': { $type: Number },
      },
    })

    await schema.validate(data)

    expect(data.numbers.field1).toBe(21)
    expect(data.numbers.field2).toBe(3.14159265359)
    expect(data.numbers.field3).toBe(0)
  })
  it('should cast match-all fields of arrays', async () => {
    const data = {
      field1: ['1', '2', '3'],
      field2: ['3.14159265359'],
      field3: ['0', '3', '7'],
    }

    const schema = new Schema({
      '*': [Number],
    })

    await schema.validate(data)

    expect(data.field1).toEqual([1, 2, 3])
    expect(data.field2).toEqual([3.14159265359])
    expect(data.field3).toEqual([0, 3, 7])
  })
  it('should not attempt to cast custom Object constructor', async () => {
    class TestType {
      name: string
    }

    const data = new TestType()
    data.name = 'Kevin'

    const schema = new Schema({
      name: String,
    })

    await schema.validate(data)

    expect(data.name).toBe('Kevin')
  })
  it('should not attempt to cast custom Array constructor', async () => {
    class MyArray extends Array {}
    const colors = new MyArray()
    colors.push('red')
    colors.push('yellow')

    class TestType {
      colors: string[]
    }

    const data = new TestType()
    data.colors = colors

    const schema = new Schema({
      colors: Array,
    })

    await schema.validate(data)

    expect(data.colors[0]).toBe('red')
  })
  it('should skip type casting when $noCast is true', async () => {
    const data = {
      answers: {
        q1: true,
        q2: 3,
        q3: 'hello',
      },
    }

    const schema = new Schema({
      answers: {
        '$type': Object,
        '$noCast': true,
        '*': {
          $or: [{ $type: Boolean }, { $type: Number }, { $type: String }],
        },
      },
    })

    await schema.validate(data)

    // Values should NOT be cast - they should remain their original types
    expect(data.answers.q1).toBe(true)
    expect(typeof data.answers.q1).toBe('boolean')
    expect(data.answers.q2).toBe(3)
    expect(typeof data.answers.q2).toBe('number')
    expect(data.answers.q3).toBe('hello')
    expect(typeof data.answers.q3).toBe('string')
  })
})
