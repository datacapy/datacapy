import Schema from 'schema'

describe('strict', () => {
  it('should fail validation in strict mode if there are properties not defined in the spec', async () => {
    const data = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com', // This property is not defined in the schema
    }

    const schema = new Schema({
      $strict: true,
      name: String,
      age: Number,
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveProperty('email')
    expect(result.errors.email[0]).toBe('Field not specified')
  })
  it('should not fail validation in strict mode for unspecified fields of type function', async () => {
    const data = {
      name: 'Kevin',
      age: 33,
      greet: function () {
        return `Hello, ${this.name}!`
      },
    }

    const schema = new Schema({
      $strict: true,
      name: String,
      age: Number,
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
  })
  it('should validate match all field', async () => {
    const data = {
      john: 'John Doe',
      kevin: 'Kevin Foster',
    }

    const schema = new Schema({
      '$strict': true,
      '*': { $type: String, $validate: { valueLength: { max: 20 } } },
    })

    const result = await schema.validate(data)
    expect(result.errors).toEqual({})
    expect(result.isValid).toBe(true)
  })
})
