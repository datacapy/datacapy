import Schema from 'schema'
import SchemaTypes from 'types'

describe('$or operator - basic functionality', function () {
  it('should validate String or Number - match first spec (String)', async () => {
    const data = { value: 'hello' }

    const schema = new Schema({
      value: {
        $or: [{ $type: String }, { $type: Number }],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.value).toBe('hello')
  })

  it('should validate String or Number - match second spec (Number)', async () => {
    const data = { value: 42 }

    const schema = new Schema({
      value: {
        $or: [{ $type: String }, { $type: Number }],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.value).toBe(42)
  })

  it('should type not typecast if exact type match in first spec', async () => {
    const data = { value: '42' }

    const schema = new Schema({
      value: {
        $or: [{ $type: String }, { $type: Number }],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.value).toBe('42')
  })

  it('should validate Object or String - match Object spec', async () => {
    const data = {
      author: {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
      },
    }

    const schema = new Schema({
      author: {
        $or: [
          {
            $type: Object,
            $spec: {
              _id: String,
              name: String,
              email: String,
            },
          },
          { $type: String },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.author._id).toBe('507f1f77bcf86cd799439011')
    expect(data.author.name).toBe('John Doe')
  })

  it('should validate Object or String - match String spec', async () => {
    const data = {
      author: '507f1f77bcf86cd799439011',
    }

    const schema = new Schema({
      author: {
        $or: [
          {
            $type: Object,
            $spec: {
              _id: String,
              name: String,
              email: String,
            },
          },
          { $type: String },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.author).toBe('507f1f77bcf86cd799439011')
  })

  it('should fail validation when no specs match', async () => {
    const data = { value: { nested: 'object' } }

    const schema = new Schema({
      value: {
        $or: [{ $type: String }, { $type: Number }],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors['value']).toBeDefined()
  })

  it('should apply filters from matching spec', async () => {
    const data = { name: '  john  ' }

    const schema = new Schema({
      name: {
        $or: [
          {
            $type: String,
            $filter: { trim: true, uppercase: true },
          },
          { $type: Number },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.name).toBe('JOHN')
  })

  it('should respect priority order - first match wins', async () => {
    const data = { value: '123' }

    const schema = new Schema({
      value: {
        $or: [
          { $type: String }, // This should match first
          { $type: Number }, // Even though it could be cast to number
        ],
      },
    })

    await schema.validate(data)
    // Should remain string because String spec is first
    expect(typeof data.value).toBe('string')
    expect(data.value).toBe('123')
  })

  it('should handle multiple fields with $or', async () => {
    const data = {
      field1: 'hello',
      field2: 42,
      field3: true,
    }

    const schema = new Schema({
      field1: {
        $or: [{ $type: String }, { $type: Number }],
      },
      field2: {
        $or: [{ $type: String }, { $type: Number }],
      },
      field3: {
        $or: [{ $type: Boolean }, { $type: String }],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.field1).toBe('hello')
    expect(data.field2).toBe(42)
    expect(data.field3).toBe(true)
  })

  it('should work with shorthand type notation in $or', async () => {
    const data = { value: 'test' }

    const schema = new Schema({
      value: {
        $or: [String, Number],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.value).toBe('test')
  })

  it('should handle $or with required validation', async () => {
    const data1 = { value: 'hello' }
    const data2 = { value: 42 }
    const data3 = {}

    const schema = new Schema({
      value: {
        $or: [
          { $type: String, $validate: { required: true } },
          { $type: Number, $validate: { required: true } },
        ],
      },
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true)

    const result3 = await schema.validate(data3)
    expect(result3.isValid).toBe(false)
  })

  it('should handle $or with null values', async () => {
    const data = { value: null }

    const schema = new Schema({
      value: {
        $or: [{ $type: String }, { $type: Number }],
      },
    })

    const result = await schema.validate(data)
    // Null should be allowed by default (no notNull validation)
    expect(result.isValid).toBe(true)
  })

  it('should provide detailed error messages when all specs fail', async () => {
    const data = { value: [] }

    const schema = new Schema({
      value: {
        $or: [
          { $type: String, $validate: { valueLength: { min: 1 } } },
          { $type: Number, $validate: { required: true } },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors['value']).toBeDefined()
    expect(result.errors['value'].length).toBeGreaterThan(0)
  })

  it('should work with array of data', async () => {
    const data = [{ value: 'test' }, { value: 42 }]

    const schema = new Schema({
      value: {
        $or: [{ $type: String }, { $type: Number }],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data[0].value).toBe('test')
    expect(data[1].value).toBe(42)
  })

  it('should handle $or with Date or String', async () => {
    const data1 = { created: new Date('2023-01-01') }
    const data2 = { created: '2023-01-01T00:00:00.000Z' }

    const schema = new Schema({
      created: {
        $or: [{ $type: Date }, { $type: String }],
      },
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)
    expect(data1.created).toBeInstanceOf(Date)

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true)
    // String is checked first in $or, so it should remain string
    expect(typeof data2.created).toBe('string')
  })

  it('should handle $or with ObjectID or String', async () => {
    const data1 = { _id: new SchemaTypes.ObjectID('507f1f77bcf86cd799439011') }
    const data2 = { _id: '507f1f77bcf86cd799439011' }

    const schema = new Schema({
      _id: {
        $or: [{ $type: SchemaTypes.ObjectID }, { $type: String }],
      },
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)
    expect(data1._id).toBeInstanceOf(SchemaTypes.ObjectID)

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true)
    // String is already the correct type, so it matches without casting (exact match preferred)
    expect(typeof data2._id).toBe('string')
    expect(data2._id).toBe('507f1f77bcf86cd799439011')
  })
})
