import Schema from 'schema'
import ObjectID from 'bson-objectid'
import { uniqueIdToBsonId } from '@datacapy/id'

describe('default value', () => {
  it('should inject default value when undefined', async () => {
    const data: { house?: number } = {}

    const schema = new Schema({
      house: { $type: Number, $filter: { defaultValue: 5 } },
    })

    await schema.validate(data)
    expect(data.house).toBe(5)
  })

  it('should inject default function value when undefined', async () => {
    const data: { created?: Date } = {}

    const schema = new Schema({
      created: { $type: Date, $filter: { defaultValue: () => new Date() } },
    })

    await schema.validate(data)
    expect(data.created).toBeInstanceOf(Date)
  })

  it('should inject default value when undefined using $spec', async () => {
    const data: { house?: number } = {}

    const schema = new Schema({
      $type: Object,
      $spec: {
        house: { $type: Number, $filter: { defaultValue: 5 } },
      },
    })

    await schema.validate(data)
    expect(data.house).toBe(5)
  })

  it('should typecast default string to date', async () => {
    const data: { created?: Date } = {}

    const schema = new Schema({
      created: { $type: Date, $filter: { defaultValue: 'now' } },
    })

    await schema.validate(data)
    expect(data.created).toBeInstanceOf(Date)
  })

  it('should inject default value when null', async () => {
    const data: { house?: number } = {}

    const schema = new Schema({
      house: { $type: Number, $filter: { defaultValue: 5 } },
    })

    await schema.validate(data)
    expect(data.house).toBe(5)
  })

  it('should inject default value when null, even when defined as not null', async () => {
    const data: { house?: number } = {}

    const schema = new Schema({
      house: {
        $type: Number,
        $validate: { notNull: true },
        $filter: { defaultValue: 5 },
      },
    })

    await schema.validate(data)
    expect(data.house).toBe(5)
  })

  describe('should validate injected default value', () => {
    it('valid not null', async () => {
      const schema = new Schema({
        house: {
          $type: Number,
          $validate: { notNull: true },
          $filter: { defaultValue: 5 },
        },
      })

      const result = await schema.validate({})
      expect(result.isValid).toBe(true)
    })

    it('invalid not null', async () => {
      const schema = new Schema({
        house: {
          $type: Number,
          $validate: { notNull: true },
          $filter: { defaultValue: null },
        },
      })

      const result = await schema.validate({})
      expect(result.isValid).toBe(false)
    })

    it('invalid not empty', async () => {
      const schema = new Schema({
        house: {
          $type: Number,
          $validate: { notEmpty: true },
          $filter: { defaultValue: 0 },
        },
      })

      const result = await schema.validate({})
      expect(result.isValid).toBe(false)
    })

    it('invalid required', async () => {
      const schema = new Schema({
        house: {
          $type: Number,
          $validate: { required: true },
          $filter: { defaultValue: undefined },
        },
      })

      const result = await schema.validate({})
      expect(result.isValid).toBe(false)
    })
  })

  it('should inject unique string if field named _id and defined as string does not have a value', async () => {
    const data: { _id?: string } = {}

    const schema = new Schema({
      _id: {
        $type: String,
      },
    })

    await schema.validate(data)
    expect(data._id).toBeDefined()
    expect(uniqueIdToBsonId(data._id as string)).toMatch(/^[0-9a-f]{24}$/i)
  })

  it('should not inject unique string if _id already has a value', async () => {
    const data: { _id?: string } = { _id: 'test' }

    const schema = new Schema({
      _id: {
        $type: String,
      },
    })

    await schema.validate(data)
    expect(data._id).toBe('test')
  })

  it('should inject new ObjectID if field named _id and defined as ObjectID does not have a value', async () => {
    const data: { _id?: ObjectID } = {}

    const schema = new Schema({
      _id: {
        $type: 'ObjectID',
      },
    })

    await schema.validate(data)
    expect(data._id).toBeInstanceOf(ObjectID)
  })

  it('should not inject new ObjectID if field name is something other than _id, defined as ObjectID and does not have a value', async () => {
    const data: { other?: ObjectID } = {}

    const schema = new Schema({
      other: {
        $type: 'ObjectID',
      },
    })

    await schema.validate(data)
    expect(data.other).toBeUndefined()
  })

  it('should inject new ObjectID if field defined as ObjectID if default value is "new"', async () => {
    const data: { other?: ObjectID } = {}

    const schema = new Schema({
      other: {
        $type: 'ObjectID',
        $filter: { defaultValue: 'new' },
      },
    })

    await schema.validate(data)
    expect(data.other).toBeInstanceOf(ObjectID)
  })

  it('should inject empty object if no default object value is provided', async () => {
    const data: { user?: ObjectID } = {}

    const schema = new Schema({
      user: {
        $type: Object,
      },
    })

    await schema.validate(data)
    expect(data.user).toEqual({})
  })

  it('should inject empty nested object if no default object value is provided', async () => {
    const data: { user?: { address: {} } } = {}

    const schema = new Schema({
      user: {
        address: {},
      },
    })

    await schema.validate(data)
    expect(data.user?.address).toEqual({})
  })

  it('should inject null for an object via $nullable flag', async () => {
    const data: { user?: { address?: { street?: string } } } = {}

    const schema = new Schema({
      user: {
        address: {
          $nullable: true,
          street: { $validate: { required: true } },
        },
      },
    })

    await schema.validate(data)
    expect(data.user?.address).toBeNull()
  })

  it('should set field with primitive type to undefined if not provided', async () => {
    const data: { name?: string } = {}

    const schema = new Schema({
      name: { $type: String },
    })

    await schema.validate(data)
    expect(data.name).toBeUndefined()
  })

  it('should set field of nested object with primitive type to undefined if not provided', async () => {
    const data: { user?: { name: string } } = {}

    const schema = new Schema({
      user: {
        name: { $type: String },
      },
    })

    await schema.validate(data)
    expect(data.user?.name).toBeUndefined()
  })

  it('should set default value on nested object even if parent object was not provided', async () => {
    const data: { user?: { name: string } } = {}

    const schema = new Schema({
      user: {
        name: { $type: String, $filter: { defaultValue: 'Kevin' } },
      },
    })

    await schema.validate(data)
    expect(data.user?.name).toBe('Kevin')
  })

  it('should set default array if undefined', async () => {
    const data: any = {}

    const schema = new Schema({
      language: {
        languages: { $type: Array, $filter: { defaultValue: ['en', 'fr'] } },
      },
    })

    await schema.validate(data)
    expect(data.language?.languages[0]).toBe('en')
    expect(data.language?.languages[1]).toBe('fr')
  })
})
