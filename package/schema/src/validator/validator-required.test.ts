import Schema from 'schema'
import { ValidatorRequired } from 'validator/index'

describe('validator - required', () => {
  describe('required', () => {
    it('should return boolean true on success', () => {
      const value = 'Kevin'
      const result = new ValidatorRequired().validate(value)

      expect(result).toBe(true)
    })

    it('should return error message on failure', () => {
      const value = undefined
      const result = new ValidatorRequired().validate(value)

      expect(typeof result).toBe('string')
    })

    it('should allow custom message', () => {
      const value = undefined
      const result = new ValidatorRequired().validate(value, {
        message: 'Name is required',
      })

      expect(result).toBe('Name is required')
    })
  })

  describe('should validate required field', () => {
    it('valid', async () => {
      const data = { house: 1 }

      const schema = new Schema({
        house: { $type: Number, $validate: { required: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('invalid', async () => {
      const data = { other: 1 }

      const schema = new Schema({
        house: { $type: Number, $validate: { required: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })

  it('should accept a null value to satisfy required setting', async () => {
    const data = { name: null }

    const schema = new Schema({
      name: { $validate: { required: true } },
    })

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
  })

  describe('should validate required embedded field', () => {
    it('valid', async () => {
      const data = { house: { bedRooms: '3', discounted: '1' } }

      const schema = new Schema({
        house: {
          bedRooms: Number,
          discounted: { $type: Boolean, $validate: { required: true } },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('invalid', async () => {
      const data = { house: { bedRooms: '2' } }

      const schema = new Schema({
        house: {
          bedRooms: Number,
          discounted: { $type: Boolean, $validate: { required: true } },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })

  describe('should validate required embedded field when given array of objects', () => {
    it('valid', async () => {
      const data = [
        { house: { bedRooms: '3', discounted: '1' } },
        { house: { bedRooms: '2', discounted: '0' } },
      ]

      const schema = new Schema({
        house: {
          bedRooms: Number,
          discounted: { $type: Boolean, $validate: { required: true } },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('invalid', async () => {
      const data = [
        { house: { bedRooms: '3', discounted: '1' } },
        { house: { bedRooms: '2' } },
      ]

      const schema = new Schema({
        house: {
          bedRooms: Number,
          discounted: { $type: Boolean, $validate: { required: true } },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })
})
