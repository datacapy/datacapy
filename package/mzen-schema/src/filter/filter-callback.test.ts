import { FilterCallback } from './filter-callback'

describe('FilterCallback', () => {
  let filter: FilterCallback

  beforeEach(() => {
    filter = new FilterCallback()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('callback')
  })

  it('should apply custom filter function', () => {
    const customFn = (value: string) => value.toUpperCase()
    const result = filter.filter('hello', customFn)
    expect(result).toBe('HELLO')
  })

  it('should pass value to custom function', () => {
    const customFn = jest.fn((value: number) => value * 2)
    filter.filter(5, customFn)
    expect(customFn).toHaveBeenCalledWith(5)
  })

  it('should return custom function result', () => {
    const customFn = (value: string) => `modified: ${value}`
    const result = filter.filter('test', customFn)
    expect(result).toBe('modified: test')
  })

  it('should handle function that returns different type', () => {
    const customFn = (value: string) => value.length
    const result = filter.filter('hello', customFn)
    expect(result).toBe(5)
  })

  it('should handle function that returns object', () => {
    const customFn = (value: string) => ({ original: value, modified: true })
    const result = filter.filter('test', customFn)
    expect(result).toEqual({ original: 'test', modified: true })
  })

  it('should handle function that returns null', () => {
    const customFn = () => null
    const result = filter.filter('test', customFn)
    expect(result).toBe(null)
  })

  it('should handle function that returns undefined', () => {
    const customFn = () => undefined
    const result = filter.filter('test', customFn)
    expect(result).toBe(undefined)
  })

  it('should return value unchanged if options is not a function', () => {
    const result = filter.filter('test', 'not a function')
    expect(result).toBe('test')
  })

  it('should return value unchanged if options is undefined', () => {
    const result = filter.filter('test', undefined)
    expect(result).toBe('test')
  })

  it('should return value unchanged if options is null', () => {
    const result = filter.filter('test', null)
    expect(result).toBe('test')
  })

  it('should handle complex transformations', () => {
    const customFn = (value: string) => {
      return value
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
    const result = filter.filter('hello world test', customFn)
    expect(result).toBe('Hello World Test')
  })

  it('should handle array manipulation', () => {
    const customFn = (value: number[]) => value.filter((n) => n > 5)
    const result = filter.filter([1, 3, 5, 7, 9], customFn)
    expect(result).toEqual([7, 9])
  })

  it('should handle object transformation', () => {
    const customFn = (value: any) => ({
      ...value,
      timestamp: Date.now(),
    })
    const input = { name: 'test' }
    const result = filter.filter(input, customFn)
    expect(result).toHaveProperty('name', 'test')
    expect(result).toHaveProperty('timestamp')
    expect(typeof result.timestamp).toBe('number')
  })

  it('should handle chaining possibility', () => {
    const addPrefix = (value: string) => `prefix_${value}`
    const result1 = filter.filter('test', addPrefix)
    const addSuffix = (value: string) => `${value}_suffix`
    const result2 = filter.filter(result1, addSuffix)
    expect(result2).toBe('prefix_test_suffix')
  })
})
