import { ValidatorEmail } from 'validator/index'

describe('validator - email', () => {
  it('should return boolean true on success', () => {
    const value = 'foobar@gmail.com'
    const result = new ValidatorEmail().validate(value)

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = 'not an email'
    const result = new ValidatorEmail().validate(value)

    expect(typeof result).toBe('string')
  })

  it('should allow custom message', () => {
    const value = 'not an email'
    const result = new ValidatorEmail().validate(value, {
      message: 'Email does appears to be valid',
    })

    expect(result).toBe('Email does appears to be valid')
  })

  it('should not allow multiple @ characters', () => {
    const value = 'test@@gmail.com'
    const result = new ValidatorEmail().validate(value)

    expect(typeof result).toBe('string')
  })
})
