import { FilterCondition } from './filter-condition'

describe('FilterCondition', () => {
  it('should evaluate $regex true when the value matches', () => {
    expect(
      FilterCondition.evaluate('https://example.com', {
        $regex: /^https?:\/\//,
      })
    ).toBe(true)
  })

  it('should evaluate $regex false when the value does not match', () => {
    expect(
      FilterCondition.evaluate('example.com', { $regex: /^https?:\/\// })
    ).toBe(false)
  })

  it('should negate a condition with $not', () => {
    expect(
      FilterCondition.evaluate('example.com', {
        $not: { $regex: /^https?:\/\// },
      })
    ).toBe(true)
    expect(
      FilterCondition.evaluate('https://example.com', {
        $not: { $regex: /^https?:\/\// },
      })
    ).toBe(false)
  })

  it('should support nested $not negation', () => {
    expect(
      FilterCondition.evaluate('example.com', {
        $not: { $not: { $regex: /^https?:\/\// } },
      })
    ).toBe(false)
  })

  it('should treat null/undefined values as empty strings for $regex', () => {
    expect(FilterCondition.evaluate(null, { $regex: /^$/ })).toBe(true)
    expect(FilterCondition.evaluate(undefined, { $regex: /^$/ })).toBe(true)
  })
})
