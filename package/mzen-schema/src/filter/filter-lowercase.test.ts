import { FilterLowercase } from './filter-lowercase'

describe('FilterLowercase', () => {
  let filter: FilterLowercase

  beforeEach(() => {
    filter = new FilterLowercase()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('lowercase')
  })

  it('should convert uppercase string to lowercase', () => {
    const result = filter.filter('HELLO WORLD')
    expect(result).toBe('hello world')
  })

  it('should convert mixed case string to lowercase', () => {
    const result = filter.filter('HeLLo WoRLd')
    expect(result).toBe('hello world')
  })

  it('should handle already lowercase string', () => {
    const result = filter.filter('hello')
    expect(result).toBe('hello')
  })

  it('should handle empty string', () => {
    const result = filter.filter('')
    expect(result).toBe('')
  })

  it('should handle strings with numbers', () => {
    const result = filter.filter('TEST123')
    expect(result).toBe('test123')
  })

  it('should handle strings with special characters', () => {
    const result = filter.filter('HELLO@WORLD.COM')
    expect(result).toBe('hello@world.com')
  })

  it('should return non-string values unchanged', () => {
    expect(filter.filter(123)).toBe(123)
    expect(filter.filter(null)).toBe(null)
    expect(filter.filter(undefined)).toBe(undefined)
    expect(filter.filter(false)).toBe(false)
    expect(filter.filter({ key: 'VALUE' })).toEqual({ key: 'VALUE' })
  })

  it('should handle unicode characters', () => {
    const result = filter.filter('CAFÉ')
    expect(result).toBe('café')
  })
})
