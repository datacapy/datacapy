import { ValidatorValueLength } from 'validator/index'

describe('validator - valueLength', () => {
  it('should return boolean true on success (min + max)', () => {
    const value = '456756789'
    const result = new ValidatorValueLength().validate(value, {
      min: 2,
      max: 9,
    })

    expect(result).toBe(true)
  })

  it('should return boolean true on success (min)', () => {
    const value = '456756789'
    const result = new ValidatorValueLength().validate(value, { min: 2 })

    expect(result).toBe(true)
  })

  it('should return boolean true on success (max)', () => {
    const value = '45'
    const result = new ValidatorValueLength().validate(value, { max: 3 })

    expect(result).toBe(true)
  })

  it('should return boolean true for max length with null value', () => {
    const value = null
    const result = new ValidatorValueLength().validate(value, { max: 3 })

    expect(result).toBe(true)
  })

  it('should return error message on failure (too short)', () => {
    const value = '456756789'
    const result = new ValidatorValueLength().validate(value, {
      min: 20,
      max: 50,
    })

    expect(typeof result).toBe('string')
  })

  it('should return error message on failure (too long)', () => {
    const value = '456756789'
    const result = new ValidatorValueLength().validate(value, {
      min: 2,
      max: 5,
    })

    expect(typeof result).toBe('string')
  })

  describe('numbers', () => {
    const validate = (value: unknown, options: object) =>
      new ValidatorValueLength().validate(value, options)

    it('should pass a number within min and max', () => {
      expect(validate(5, { min: 3, max: 10 })).toBe(true)
      expect(validate(3, { min: 3 })).toBe(true)
      expect(validate(10, { max: 10 })).toBe(true)
    })

    it('should pass a Number object within the limits', () => {
      expect(validate(new Number(5), { min: 3, max: 10 })).toBe(true)
    })

    it('should reject a number below min', () => {
      expect(validate(2, { min: 3 })).toBe(
        'field must be at least 3 characters long'
      )
    })

    it('should reject a number above max', () => {
      expect(validate(11, { max: 10 })).toBe(
        'field must be no more than 10 characters long'
      )
    })

    it('should reject NaN against either limit', () => {
      expect(typeof validate(NaN, { min: 1 })).toBe('string')
      expect(typeof validate(NaN, { max: 10 })).toBe('string')
    })
  })

  describe('zero limits', () => {
    const validate = (value: unknown, options: object) =>
      new ValidatorValueLength().validate(value, options)

    it('should enforce max: 0', () => {
      expect(typeof validate('abc', { max: 0 })).toBe('string')
      expect(typeof validate([1], { max: 0 })).toBe('string')
      expect(validate('', { max: 0 })).toBe(true)
      expect(validate([], { max: 0 })).toBe(true)
    })

    it('should treat min: 0 as satisfied by an empty string', () => {
      expect(validate('', { min: 0 })).toBe(true)
    })

    it('should reject a negative number against min: 0', () => {
      expect(typeof validate(-1, { min: 0 })).toBe('string')
    })
  })

  describe('unconstrained types', () => {
    it('should keep passing booleans and dates', () => {
      const validator = new ValidatorValueLength()
      expect(validator.validate(true, { min: 3 })).toBe(true)
      expect(validator.validate(new Date(), { max: 5 })).toBe(true)
    })
  })

  it('should allow custom message', () => {
    const value = '456756789'
    const result = new ValidatorValueLength().validate(value, {
      min: 20,
      max: 50,
      message: 'Code should be between 10 and 50 characters long',
    })

    expect(result).toBe('Code should be between 10 and 50 characters long')
  })
})
