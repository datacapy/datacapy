import Schema from 'schema'
import { ValidatorNotNull } from 'validator/index'

describe('validator - notNull', () => {
  describe('notNull', () => {
    it('should return boolean true on success', () => {
      const value = 'Kevin'
      const result = new ValidatorNotNull().validate(value)

      expect(result).toBe(true)
    })

    it('should return error message on failure', () => {
      const value = null
      const result = new ValidatorNotNull().validate(value)

      expect(typeof result).toBe('string')
    })

    it('should allow custom message', () => {
      const value = null
      const result = new ValidatorNotNull().validate(value, {
        message: 'Name can not be null',
      })

      expect(result).toBe('Name can not be null')
    })
  })

  describe('should validate notNull field', () => {
    it('valid', async () => {
      const data = { name: 'Kevin' }

      const schema = new Schema({
        name: { $type: String, $validate: { notNull: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('invalid', async () => {
      const data = { name: null }

      const schema = new Schema({
        name: { $type: String, $validate: { notNull: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })

    it('falsey value disables validator - false', async () => {
      const data = { name: null }

      const schema = new Schema({
        name: { $type: String, $validate: { notNull: false } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('falsey value disables validator - undefined', async () => {
      const data = { name: null }

      const schema = new Schema({
        name: { $type: String, $validate: { notNull: undefined } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('falsey value disables validator - null', async () => {
      const data = { name: null }

      const schema = new Schema({
        name: { $type: String, $validate: { notNull: null } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
  })

  describe('should validate notNull on array elements with mixed type values', () => {
    it('valid - valid array of 1', async () => {
      const data = { name: [1] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notNull: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('valid - valid array of array of 1', async () => {
      const data = { name: [[1]] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notNull: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })

    it('invalid - array of null', async () => {
      const data = { name: [null] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notNull: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })

  describe('the string "null"', () => {
    it.each(['null', 'Null', 'NULL'])('accepts %j by default', (value) => {
      expect(new ValidatorNotNull().validate(value)).toBe(true)
    })

    it('rejects it when treatNullStringAsNull is set', () => {
      const validator = new ValidatorNotNull()
      expect(
        typeof validator.validate('Null', { treatNullStringAsNull: true })
      ).toBe('string')
      expect(validator.validate('Smith', { treatNullStringAsNull: true })).toBe(
        true
      )
    })

    it('still rejects a real null through a schema', async () => {
      const schema = new Schema({
        name: { $type: String, $validate: { notNull: true } },
      })
      expect((await schema.validate({ name: 'Null' })).isValid).toBe(true)
      expect((await schema.validate({ name: null })).isValid).toBe(false)
    })
  })
})
