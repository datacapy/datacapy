import { ValidatorCallback } from './validator-callback'

describe('validator - callback', () => {
  it('should return boolean true on success', () => {
    const value = 'Kevin'
    const result = new ValidatorCallback().validate(value, {
      validator: (_value) => true,
    })

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = undefined
    const result = new ValidatorCallback().validate(value, {
      validator: (_value) => 'error message',
    })

    expect(typeof result).toBe('string')
  })
})
