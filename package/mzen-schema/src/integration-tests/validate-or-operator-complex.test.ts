import Schema from 'schema'

describe('$or operator - complex scenarios', function () {
  it('should validate with different validation rules per spec', async () => {
    const data1 = {
      email: 'test@example.com',
      confirmEmail: 'test@example.com',
    }
    const data2 = { email: 'not-an-email', confirmEmail: 'not-an-email' }

    const schema = new Schema({
      email: {
        $or: [
          {
            $type: String,
            $validate: { email: true },
          },
          {
            $type: String,
            $validate: {
              equality: { path: 'confirmEmail' },
              valueLength: { min: 3 },
            },
          },
        ],
      },
      confirmEmail: String,
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true)
  })

  it('should work with nested objects containing $or', async () => {
    const data = {
      user: {
        id: '123',
        contact: 'email@example.com',
      },
    }

    const schema = new Schema({
      user: {
        id: String,
        contact: {
          $or: [
            { $type: String, $validate: { email: true } },
            { $type: Object, $spec: { phone: String, address: String } },
          ],
        },
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.user.contact).toBe('email@example.com')
  })

  it('should handle $or with array types', async () => {
    const data1 = { items: [1, 2, 3] }
    const data2 = { items: ['a', 'b', 'c'] }

    const schema = new Schema({
      items: {
        $or: [
          { $type: Array, $spec: Number },
          { $type: Array, $spec: String },
        ],
      },
    })

    const result1 = await schema.validate(data1)
    expect(result1.isValid).toBe(true)
    expect(data1.items).toEqual([1, 2, 3])

    const result2 = await schema.validate(data2)
    expect(result2.isValid).toBe(true)
    expect(data2.items).toEqual(['a', 'b', 'c'])
  })

  it('should handle complex nested $or scenarios', async () => {
    const data = {
      result: {
        success: true,
        data: {
          id: '123',
          value: 'test',
        },
      },
    }

    const schema = new Schema({
      result: {
        $or: [
          {
            $type: Object,
            $spec: {
              success: Boolean,
              data: {
                id: String,
                value: String,
              },
            },
          },
          {
            $type: Object,
            $spec: {
              error: String,
              code: Number,
            },
          },
        ],
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.result.data.id).toBe('123')
  })
})
