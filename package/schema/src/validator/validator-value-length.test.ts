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
