import Schema from 'schema'

describe('validator - strict', () => {
  it('should fail validation in strict mode if unspecified field exists', async () => {
    const data = { age: '33', pi: '3.14159265359' }

    const schema = new Schema({
      $strict: true,
      age: Number,
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
  })

  it('should fail validation, strict mode propagates', async () => {
    const data = {
      name: 'Kevin',
      address: {
        street: 'London Road',
        city: 'Liverpool',
      },
    }

    const schema = new Schema({
      $strict: true,
      name: 'string',
      address: {
        street: 'string',
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
  })

  it('should fail validation, strict mode propagates deep', async () => {
    const data = {
      a: {
        b: {
          name: 'Kevin',
          address: {
            street: 'London Road',
            city: 'Liverpool',
          },
        },
      },
    }

    const schema = new Schema({
      $strict: true,
      a: {
        b: {
          name: String,
          address: {
            street: String,
          },
        },
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
  })

  it('should allow strict mode propagation to be overridden', async () => {
    const data = {
      name: 'Kevin',
      address: {
        street: 'London Road',
        city: 'Liverpool',
      },
    }

    const schema = new Schema({
      $strict: true,
      name: String,
      address: {
        $strict: false,
        street: String,
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
  })
})
