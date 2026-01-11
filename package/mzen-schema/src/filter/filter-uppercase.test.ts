import { FilterUppercase } from './filter-uppercase'

describe('FilterUppercase', () => {
  let filter: FilterUppercase

  beforeEach(() => {
    filter = new FilterUppercase()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('uppercase')
  })

  it('should convert lowercase string to uppercase', () => {
    const result = filter.filter('hello world')
    expect(result).toBe('HELLO WORLD')
  })

  it('should convert mixed case string to uppercase', () => {
    const result = filter.filter('HeLLo WoRLd')
    expect(result).toBe('HELLO WORLD')
  })

  it('should handle already uppercase string', () => {
    const result = filter.filter('HELLO')
    expect(result).toBe('HELLO')
  })

  it('should handle empty string', () => {
    const result = filter.filter('')
    expect(result).toBe('')
  })

  it('should handle strings with numbers', () => {
    const result = filter.filter('test123')
    expect(result).toBe('TEST123')
  })

  it('should handle strings with special characters', () => {
    const result = filter.filter('hello@world.com')
    expect(result).toBe('HELLO@WORLD.COM')
  })

  it('should return non-string values unchanged', () => {
    expect(filter.filter(123)).toBe(123)
    expect(filter.filter(null)).toBe(null)
    expect(filter.filter(undefined)).toBe(undefined)
    expect(filter.filter(true)).toBe(true)
    expect(filter.filter({ key: 'value' })).toEqual({ key: 'value' })
  })

  it('should handle unicode characters', () => {
    const result = filter.filter('café')
    expect(result).toBe('CAFÉ')
  })
})
