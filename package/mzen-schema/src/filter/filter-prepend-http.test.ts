import { FilterPrependHttp } from './filter-prepend-http'

describe('FilterPrependHttp', () => {
  let filter: FilterPrependHttp

  beforeEach(() => {
    filter = new FilterPrependHttp()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('prependHttp')
  })

  it('should prepend http:// to a plain string', () => {
    expect(filter.filter('example.com')).toBe('http://example.com')
  })

  it('should leave empty string unchanged', () => {
    expect(filter.filter('')).toBe('')
  })

  it('should return non-string values unchanged', () => {
    expect(filter.filter(123)).toBe(123)
    expect(filter.filter(null)).toBe(null)
    expect(filter.filter(undefined)).toBe(undefined)
  })
})
