import { FilterPostcode } from './filter-postcode'

describe('FilterPostcode', () => {
  let filter: FilterPostcode

  beforeEach(() => {
    filter = new FilterPostcode()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('postcode')
  })

  describe('UK postcode formatting', () => {
    it('should format AN NAA pattern (M1 1AA)', () => {
      const result = filter.filter('M11AA')
      expect(result).toBe('M1 1AA')
    })

    it('should format ANN NAA pattern (M60 1NW)', () => {
      const result = filter.filter('M601NW')
      expect(result).toBe('M60 1NW')
    })

    it('should format AAN NAA pattern (CR2 6XH)', () => {
      const result = filter.filter('CR26XH')
      expect(result).toBe('CR2 6XH')
    })

    it('should format AANN NAA pattern (DN55 1PT)', () => {
      const result = filter.filter('DN551PT')
      expect(result).toBe('DN55 1PT')
    })

    it('should format ANA NAA pattern (W1A 1HQ)', () => {
      const result = filter.filter('W1A1HQ')
      expect(result).toBe('W1A 1HQ')
    })

    it('should format AANA NAA pattern (EC1A 1BB)', () => {
      const result = filter.filter('EC1A1BB')
      expect(result).toBe('EC1A 1BB')
    })
  })

  describe('case handling', () => {
    it('should convert lowercase to uppercase', () => {
      const result = filter.filter('m11aa')
      expect(result).toBe('M1 1AA')
    })

    it('should convert mixed case to uppercase', () => {
      const result = filter.filter('M1a1aA')
      expect(result).toBe('M1A 1AA')
    })

    it('should handle already uppercase postcode', () => {
      const result = filter.filter('M1 1AA')
      expect(result).toBe('M1 1AA')
    })
  })

  describe('whitespace handling', () => {
    it('should trim leading and trailing whitespace', () => {
      const result = filter.filter('  M11AA  ')
      expect(result).toBe('M1 1AA')
    })

    it('should handle postcode with correct spacing', () => {
      const result = filter.filter('M1 1AA')
      expect(result).toBe('M1 1AA')
    })

    it('should remove multiple spaces', () => {
      const result = filter.filter('M1  1AA')
      expect(result).toBe('M1 1AA')
    })

    it('should remove multiple spaces but preserve tabs', () => {
      const result = filter.filter('M1  1AA')
      expect(result).toBe('M1 1AA')
    })
  })

  describe('edge cases', () => {
    it('should handle already formatted postcode', () => {
      const result = filter.filter('L24 9HJ')
      expect(result).toBe('L24 9HJ')
    })

    it('should handle postcode with existing space in wrong position', () => {
      const result = filter.filter('L2 49HJ')
      expect(result).toBe('L2 49HJ')
    })

    it('should not add space to short strings', () => {
      const result = filter.filter('M1')
      expect(result).toBe('M1')
    })

    it('should not add space to strings longer than 7 characters', () => {
      const result = filter.filter('TOOLONGCODE')
      expect(result).toBe('TOOLONGCODE')
    })

    it('should handle minimum valid length (5 characters)', () => {
      const result = filter.filter('M11AA')
      expect(result).toBe('M1 1AA')
    })

    it('should handle maximum valid length (7 characters)', () => {
      const result = filter.filter('EC1A1BB')
      expect(result).toBe('EC1A 1BB')
    })
  })

  describe('real UK postcodes', () => {
    it('should format common London postcodes', () => {
      expect(filter.filter('SW1A1AA')).toBe('SW1A 1AA')
      expect(filter.filter('W1A0AX')).toBe('W1A 0AX')
      expect(filter.filter('N10AA')).toBe('N1 0AA')
    })

    it('should format Liverpool postcodes', () => {
      expect(filter.filter('L14LN')).toBe('L1 4LN')
      expect(filter.filter('L249HJ')).toBe('L24 9HJ')
    })

    it('should format Manchester postcodes', () => {
      expect(filter.filter('M11AA')).toBe('M1 1AA')
      expect(filter.filter('M601NW')).toBe('M60 1NW')
    })
  })
})
