import Schema from 'schema'

describe('validator', () => {
  it('should fail validation if attempt to cast object to primitive', async () => {
    const data = { person: { age: '33' } }

    const schema = new Schema({
      person: String,
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
  })

  it('should honour defaultNotNull value', async () => {
    const data = { name: null }

    const schema = new Schema({ name: String }, { defaultNotNull: true })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
  })

  it('should honour defaultNotNull value even if field is not defined in spec', async () => {
    const data = { name: { first: null } }

    const schema = new Schema(
      { name: { last: String } },
      { defaultNotNull: true }
    )

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
  })

  it('should populate errors object on failure', async () => {
    const data = { other: 1 }

    const schema = new Schema({
      house: { $type: Number, $validate: { required: true } },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors).toBeInstanceOf(Object)
    expect(Array.isArray(result.errors.house)).toBe(true)
  })

  it('should populate custom error message on failure', async () => {
    const data = { other: 1 }

    const schema = new Schema({
      house: { $type: Number, $validate: { required: true } },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors.house[0]).toBe('house is required')
  })

  it('should use custom label in error message', async () => {
    const data = { other: 1 }

    const schema = new Schema({
      house: {
        $label: 'House number',
        $type: Number,
        $validate: { required: true },
      },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(false)
    expect(result.errors.house[0]).toBe('House number is required')
  })
})
