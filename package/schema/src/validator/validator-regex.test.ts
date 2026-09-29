import { ValidatorRegex } from 'validator/index'

describe('validator - regex', () => {
  it('should return boolean true on success', () => {
    const value = 'Kevin'
    const result = new ValidatorRegex().validate(value, {
      pattern: '^[a-zA-Z]+',
    })

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = '123'
    const result = new ValidatorRegex().validate(value, {
      pattern: '^[a-zA-Z]+',
    })

    expect(typeof result).toBe('string')
  })

  it('should allow custom message', () => {
    const value = '123'
    const result = new ValidatorRegex().validate(value, {
      pattern: '^[a-zA-Z]+',
      message: 'Name does not appear to be valid',
    })

    expect(result).toBe('Name does not appear to be valid')
  })
})
