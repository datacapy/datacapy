import { FilterTrim } from './filter-trim'

describe('FilterTrim', () => {
  let filter: FilterTrim

  beforeEach(() => {
    filter = new FilterTrim()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('trim')
  })

  it('should trim leading whitespace', () => {
    const result = filter.filter('  hello')
    expect(result).toBe('hello')
  })

  it('should trim trailing whitespace', () => {
    const result = filter.filter('hello  ')
    expect(result).toBe('hello')
  })

  it('should trim both leading and trailing whitespace', () => {
    const result = filter.filter('  hello  ')
    expect(result).toBe('hello')
  })

  it('should preserve internal whitespace', () => {
    const result = filter.filter('  hello  world  ')
    expect(result).toBe('hello  world')
  })

  it('should handle string with no whitespace', () => {
    const result = filter.filter('hello')
    expect(result).toBe('hello')
  })

  it('should handle empty string', () => {
    const result = filter.filter('')
    expect(result).toBe('')
  })

  it('should handle string with only whitespace', () => {
    const result = filter.filter('   ')
    expect(result).toBe('')
  })

  it('should handle tabs and newlines', () => {
    const result = filter.filter('\t\nhello\n\t')
    expect(result).toBe('hello')
  })

  it('should return non-string values unchanged', () => {
    expect(filter.filter(123)).toBe(123)
    expect(filter.filter(null)).toBe(null)
    expect(filter.filter(undefined)).toBe(undefined)
    expect(filter.filter(true)).toBe(true)
    expect(filter.filter(['  value  '])).toEqual(['  value  '])
  })
})
