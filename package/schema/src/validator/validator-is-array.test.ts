import { ValidatorInArray } from 'validator/index'

describe('validator - inArray', () => {
  it('should return boolean true on success', () => {
    const value = 'Car'
    const result = new ValidatorInArray().validate(value, {
      name: 'Transport',
      values: ['Car', 'Bus', 'Train', 'Boat'],
    })

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = 'Guitar'
    const result = new ValidatorInArray().validate(value, {
      name: 'Transport',
      values: ['Car', 'Bus', 'Train', 'Boat'],
    })

    expect(typeof result).toBe('string')
  })

  it('should allow custom message', () => {
    const value = 'Guitar'
    const result = new ValidatorInArray().validate(value, {
      name: 'Transport',
      values: ['Car', 'Bus', 'Train', 'Boat'],
      message: 'Value is not valid',
    })

    expect(result).toBe('Value is not valid')
  })
})
