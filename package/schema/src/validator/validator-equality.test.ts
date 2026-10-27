import { ValidatorEquality } from 'validator/index'

describe('validator - equality', () => {
  it('should return boolean true on success', () => {
    const value = { a: 123, b: 123 }
    const result = new ValidatorEquality().validate(value.a, {
      path: 'b',
      name: 'A',
      root: value,
    })

    expect(result).toBe(true)
  })

  it('should return error message on failure', () => {
    const value = { a: 123, b: 4567 }
    const result = new ValidatorEquality().validate(value.a, {
      path: 'b',
      name: 'A',
      root: value,
    })

    expect(typeof result).toBe('string')
  })

  it('should allow custom message', () => {
    const value = { a: 123, b: 4567 }
    const result = new ValidatorEquality().validate(value.a, {
      path: 'b',
      name: 'A',
      root: value,
      message: 'Values do not match',
    })

    expect(result).toBe('Values do not match')
  })

  it('fails closed when no path is given', () => {
    expect(typeof new ValidatorEquality().validate(1, { root: { a: 1 } })).toBe(
      'string'
    )
  })

  it('resolves dotted paths', () => {
    const root = { user: { password: 'abc' } }
    const validator = new ValidatorEquality()
    expect(validator.validate('abc', { path: 'user.password', root })).toBe(
      true
    )
    expect(
      typeof validator.validate('xyz', { path: 'user.password', root })
    ).toBe('string')
  })
})
