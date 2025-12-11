import Schema from 'schema'
import Types from 'types'
import { ValidatorNotEmpty } from 'validator/index'

describe('validator - notEmpty', () => {
  describe('notEmpty', () => {
    it('should return boolean true on success', () => {
      const value = 'Kevin'
      const result = new ValidatorNotEmpty().validate(value)

      expect(result).toBe(true)
    })
    it('should return error message on failure', () => {
      const value = ''
      const result = new ValidatorNotEmpty().validate(value)

      expect(typeof result).toBe('string')
    })
    it('should allow custom message', () => {
      const value = ''
      const result = new ValidatorNotEmpty().validate(value, {
        message: 'Name can not be empty',
      })

      expect(result).toBe('Name can not be empty')
    })
  })
  describe('should validate notEmpty field', () => {
    it('valid - not empty string', async () => {
      // An empty field is any falsy value: undefined, null, false, 0, '', [], {}
      const data = { name: 'Kevin' }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - undefined', async () => {
      // An empty field is any falsy value: undefined, null, false, 0, '', [], {}
      // but if the field is not required the notEmpty validator does not run
      const data = { name: undefined }

      const schema = new Schema({
        name: {
          $type: Types.Mixed,
          $validate: { required: false, notEmpty: true },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - null', async () => {
      // An empty field is any falsy value: undefined, null, false, 0, '', [], {}
      // but if specified as notNull it can be null and notEmpty validator does not run
      const data = { name: null }

      const schema = new Schema({
        name: {
          $type: Types.Mixed,
          $validate: { notNull: false, notEmpty: true },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - false', async () => {
      const data = { name: false }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('invalid - zero', async () => {
      const data = { name: 0 }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('invalid - empty string', async () => {
      const data = { name: '' }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('valid - not empty array', async () => {
      const data = { name: [1] }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - empty array', async () => {
      const data = { name: [] }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('valid - empty array contains empty array', async () => {
      const data = { name: [[]] }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - not empty object', async () => {
      const validDataNotEmptyObject = { name: { test: 1 } }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(validDataNotEmptyObject)
      expect(result.isValid).toBe(true)
    })
    it('invalid - empty object', async () => {
      const data = { name: {} }

      const schema = new Schema({
        name: { $type: Types.Mixed, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })

  describe('should validate notEmpty object with spec', () => {
    it('valid', async () => {
      // An empty object is an object with zero fields
      const data = { name: { first: 'Kevin' } }

      const schema = new Schema({
        name: {
          $type: 'Object',
          $spec: {
            first: { $type: String, $validate: { notEmpty: true } },
          },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - undefined', async () => {
      const data = { name: undefined }

      const schema = new Schema({
        name: {
          $type: 'Object',
          $spec: {
            first: {
              $type: String,
              $validate: { required: true, notEmpty: true },
            },
          },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('valid - null', async () => {
      const data = { name: { first: null } }

      const schema = new Schema({
        name: {
          $type: 'Object',
          $spec: {
            first: {
              $type: String,
              $validate: { notNull: false, notEmpty: true },
            },
          },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - not empty object', async () => {
      const data = { name: { other: 1 } }

      const schema = new Schema({
        name: {
          $type: 'Object',
          $validate: { notEmpty: true },
          $spec: {
            first: { $type: String },
          },
        },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - empty object', async () => {
      const data = { name: {} }

      const schema = new Schema({
        name: { $type: 'Object', $validate: { notEmpty: true }, $spec: {} },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })
  describe('should validate notEmpty array with spec', () => {
    it('valid', async () => {
      // An empty field is any falsy value: undefined, null, false, 0, '', [], {}
      const data = { name: [1] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of array', async () => {
      const data = { name: [[1]] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of zero', async () => {
      const data = { name: [0] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of null', async () => {
      const data = { name: [null] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notNull: false, notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of undefined', async () => {
      const data = { name: [undefined] }

      const schema = new Schema({
        name: { $type: Array, $validate: { required: false, notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of false', async () => {
      const data = { name: [false] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of empty array', async () => {
      const data = { name: [[]] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - empty array', async () => {
      const data = { name: [] }

      const schema = new Schema({
        name: { $type: Array, $validate: { notEmpty: true } },
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })
  describe('should validate notEmpty on array elements with mixed type values', () => {
    it('valid - array of 1', async () => {
      // An empty field is any falsy value: undefined, null, false, 0, '', [], {}
      const data = { name: [1] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notEmpty: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of array of 1', async () => {
      const data = { name: [[1]] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notEmpty: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - array of zero', async () => {
      const data = { name: [0] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notEmpty: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('valid - array of null', async () => {
      const data = { name: [null] }

      const schema = new Schema({
        name: [
          { $type: 'Mixed', $validate: { notNull: false, notEmpty: true } },
        ],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('valid - array of undefined', async () => {
      const data = { name: [undefined] }

      const schema = new Schema({
        name: [
          { $type: 'Mixed', $validate: { required: false, notEmpty: true } },
        ],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(true)
    })
    it('invalid - array of false', async () => {
      const data = { name: [false] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notEmpty: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
    it('invalid - array of empty array', async () => {
      const data = { name: [[]] }

      const schema = new Schema({
        name: [{ $type: 'Mixed', $validate: { notEmpty: true } }],
      })

      const result = await schema.validate(data)
      expect(result.isValid).toBe(false)
    })
  })
})
