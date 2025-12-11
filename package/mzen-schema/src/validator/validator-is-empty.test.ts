import { ValidatorIsEmpty } from 'validator/index'

describe('validator - isEmpty', () => {
  it('should return boolean true on success', () => {
    const value = ''
    const result = new ValidatorIsEmpty().validate(value)

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = 'not empty'
    const result = new ValidatorIsEmpty().validate(value)

    expect(typeof result).toBe('string')
  })

  it('should allow custom message', () => {
    const value = 'not empty'
    const result = new ValidatorIsEmpty().validate(value, {
      message: 'Name must be empty',
    })

    expect(result).toBe('Name must be empty')
  })
})
