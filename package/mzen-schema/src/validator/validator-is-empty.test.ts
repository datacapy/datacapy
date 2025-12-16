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

  it('should treat 0 as empty by default', () => {
    const value = 0
    const result = new ValidatorIsEmpty().validate(value)

    expect(result).toBe(true)
  })

  it('should not treat 0 as empty with allowZero option', () => {
    const value = 0
    const result = new ValidatorIsEmpty().validate(value, { allowZero: true })

    expect(typeof result).toBe('string')
  })

  it('should treat false as empty by default', () => {
    const value = false
    const result = new ValidatorIsEmpty().validate(value)

    expect(result).toBe(true)
  })

  it('should not treat false as empty with allowFalse option', () => {
    const value = false
    const result = new ValidatorIsEmpty().validate(value, { allowFalse: true })

    expect(typeof result).toBe('string')
  })

  it('should not treat 0 or false as empty with permissive option', () => {
    const zeroResult = new ValidatorIsEmpty().validate(0, { permissive: true })
    const falseResult = new ValidatorIsEmpty().validate(false, { permissive: true })

    expect(typeof zeroResult).toBe('string')
    expect(typeof falseResult).toBe('string')
  })

  it('should still treat NaN as empty with allowZero option', () => {
    const value = NaN
    const result = new ValidatorIsEmpty().validate(value, { allowZero: true })

    expect(result).toBe(true)
  })

  it('should still treat undefined as empty with permissive option', () => {
    const value = undefined
    const result = new ValidatorIsEmpty().validate(value, { permissive: true })

    expect(result).toBe(true)
  })
})
