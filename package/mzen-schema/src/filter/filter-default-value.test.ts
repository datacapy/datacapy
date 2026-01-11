import { FilterDefaultValue } from './filter-default-value'

describe('FilterDefaultValue', () => {
  let filter: FilterDefaultValue

  beforeEach(() => {
    filter = new FilterDefaultValue()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('defaultValue')
  })

  it('should have correct config', () => {
    const config = filter.getConfig()
    expect(config.allowMultiple).toBe(false)
  })

  describe('undefined values', () => {
    it('should replace undefined with default value', () => {
      const result = filter.filter(undefined, 'default')
      expect(result).toBe('default')
    })

    it('should replace undefined with numeric default', () => {
      const result = filter.filter(undefined, 42)
      expect(result).toBe(42)
    })

    it('should replace undefined with object default', () => {
      const defaultObj = { key: 'value' }
      const result = filter.filter(undefined, defaultObj)
      expect(result).toBe(defaultObj)
    })
  })

  describe('null values', () => {
    it('should replace null with default value', () => {
      const result = filter.filter(null, 'default')
      expect(result).toBe('default')
    })

    it('should replace string "null" with default value', () => {
      const result = filter.filter('null', 'default')
      expect(result).toBe('default')
    })

    it('should replace string "NULL" with default value', () => {
      const result = filter.filter('NULL', 'default')
      expect(result).toBe('default')
    })

    it('should replace string "Null" with default value', () => {
      const result = filter.filter('Null', 'default')
      expect(result).toBe('default')
    })
  })

  describe('empty arrays', () => {
    it('should replace empty array with default value', () => {
      const result = filter.filter([], 'default')
      expect(result).toBe('default')
    })

    it('should not replace non-empty array', () => {
      const arr = [1, 2, 3]
      const result = filter.filter(arr, 'default')
      expect(result).toBe(arr)
    })
  })

  describe('function default values', () => {
    it('should call function to get default value', () => {
      const defaultFn = jest.fn(() => 'computed')
      const result = filter.filter(undefined, defaultFn)
      expect(result).toBe('computed')
      expect(defaultFn).toHaveBeenCalledTimes(1)
    })

    it('should call function for null values', () => {
      const defaultFn = jest.fn(() => 42)
      const result = filter.filter(null, defaultFn)
      expect(result).toBe(42)
      expect(defaultFn).toHaveBeenCalledTimes(1)
    })

    it('should call function for empty arrays', () => {
      const defaultFn = jest.fn(() => ['default'])
      const result = filter.filter([], defaultFn)
      expect(result).toEqual(['default'])
      expect(defaultFn).toHaveBeenCalledTimes(1)
    })

    it('should not call function if value is valid', () => {
      const defaultFn = jest.fn(() => 'default')
      const result = filter.filter('value', defaultFn)
      expect(result).toBe('value')
      expect(defaultFn).not.toHaveBeenCalled()
    })
  })

  describe('values that should not be replaced', () => {
    it('should not replace string values', () => {
      const result = filter.filter('test', 'default')
      expect(result).toBe('test')
    })

    it('should not replace empty string', () => {
      const result = filter.filter('', 'default')
      expect(result).toBe('')
    })

    it('should not replace number 0', () => {
      const result = filter.filter(0, 'default')
      expect(result).toBe(0)
    })

    it('should not replace boolean false', () => {
      const result = filter.filter(false, 'default')
      expect(result).toBe(false)
    })

    it('should not replace boolean true', () => {
      const result = filter.filter(true, 'default')
      expect(result).toBe(true)
    })

    it('should not replace objects', () => {
      const obj = { key: 'value' }
      const result = filter.filter(obj, 'default')
      expect(result).toBe(obj)
    })

    it('should not replace empty object', () => {
      const obj = {}
      const result = filter.filter(obj, 'default')
      expect(result).toBe(obj)
    })
  })

  describe('isNull static method', () => {
    it('should return true for null', () => {
      expect(FilterDefaultValue.isNull(null)).toBe(true)
    })

    it('should return true for string "null"', () => {
      expect(FilterDefaultValue.isNull('null')).toBe(true)
    })

    it('should return true for string "NULL"', () => {
      expect(FilterDefaultValue.isNull('NULL')).toBe(true)
    })

    it('should return false for undefined', () => {
      expect(FilterDefaultValue.isNull(undefined)).toBe(false)
    })

    it('should return false for other strings', () => {
      expect(FilterDefaultValue.isNull('test')).toBe(false)
      expect(FilterDefaultValue.isNull('')).toBe(false)
    })

    it('should return false for numbers', () => {
      expect(FilterDefaultValue.isNull(0)).toBe(false)
      expect(FilterDefaultValue.isNull(42)).toBe(false)
    })
  })
})
