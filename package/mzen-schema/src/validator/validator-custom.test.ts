import { ValidatorCustom } from 'validator/index'

describe('validator - custom', () => {
  it('should return boolean true on success', () => {
    const value = 'Kevin'
    const result = new ValidatorCustom().validate(value, {
      validator: (_value) => true,
    })

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = undefined
    const result = new ValidatorCustom().validate(value, {
      validator: (_value) => 'error message',
    })

    expect(typeof result).toBe('string')
  })
})
