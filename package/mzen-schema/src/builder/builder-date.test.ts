import { BuilderDate } from './builder-date'
import { sb } from './index'

/**
 * Test suite for BuilderDate class
 * Tests date field creation and inherited validation/filter methods
 */
describe('BuilderDate', () => {
  describe('basic creation', () => {
    it('should create a date field with correct type', () => {
      const spec = sb.date().build()
      expect(spec.$type).toBe(Date)
    })

    it('should create a date field using new BuilderDate()', () => {
      const spec = new BuilderDate().build()
      expect(spec.$type).toBe(Date)
    })
  })

  describe('inherited validation methods', () => {
    it('should support required()', () => {
      const spec = sb.date().required().build()
      expect(spec.$type).toBe(Date)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support required() with options', () => {
      const options = { message: 'Date is required' }
      const spec = sb.date().required(options).build()
      expect(spec.$validate?.required).toEqual(options)
    })

    it('should support notNull()', () => {
      const spec = sb.date().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notNull() with options', () => {
      const options = { message: 'Cannot be null' }
      const spec = sb.date().notNull(options).build()
      expect(spec.$validate?.notNull).toEqual(options)
    })

    it('should support notEmpty()', () => {
      const spec = sb.date().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support isEmpty()', () => {
      const spec = sb.date().isEmpty().build()
      expect(spec.$validate?.isEmpty).toBe(true)
    })
  })

  describe('inherited filter methods', () => {
    it('should support default() with Date object', () => {
      const defaultDate = new Date('2024-01-01')
      const spec = sb.date().default(defaultDate).build()
      expect(spec.$filter?.defaultValue).toBe(defaultDate)
    })

    it('should support default() with "now" string', () => {
      const spec = sb.date().default('now').build()
      expect(spec.$filter?.defaultValue).toBe('now')
    })

    it('should support default() with date string', () => {
      const spec = sb.date().default('2024-12-31').build()
      expect(spec.$filter?.defaultValue).toBe('2024-12-31')
    })

    it('should support private()', () => {
      const spec = sb.date().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support private() with mode parameter', () => {
      const spec = sb.date().private('admin').build()
      expect((spec.$filter as any)?.private).toBe('admin')
    })

    it('should support private() with false', () => {
      const spec = sb.date().private(false).build()
      expect((spec.$filter as any)?.private).toBe(false)
    })

    it('should support privateValue()', () => {
      const spec = sb.date().privateValue().build()
      expect((spec.$filter as any)?.privateValue).toBe(true)
    })

    it('should support filter()', () => {
      const customFn = (value: any) => value instanceof Date
      const spec = sb.date().filter(customFn).build()
      expect(spec.$filter?.custom).toBe(customFn)
    })
  })

  describe('inherited metadata methods', () => {
    it('should support label()', () => {
      const spec = sb.date().label('Birth Date').build()
      expect(spec.$label).toBe('Birth Date')
    })

    it('should support nullable()', () => {
      const spec = sb.date().nullable().build()
      expect(spec.$nullable).toBe(true)
    })

    it('should support relation()', () => {
      const spec = sb.date().relation().build()
      expect(spec.$relation).toBe(true)
    })

    it('should support relation() with false', () => {
      const spec = sb.date().relation(false).build()
      expect(spec.$relation).toBe(false)
    })
  })

  describe('method chaining', () => {
    it('should chain multiple validation methods', () => {
      const spec = sb.date().required().notNull().build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should chain validation and filter methods', () => {
      const spec = sb
        .date()
        .required({ message: 'Birth date is required' })
        .default('now')
        .label('Date of Birth')
        .build()

      expect(spec.$validate?.required).toEqual({
        message: 'Birth date is required',
      })
      expect(spec.$filter?.defaultValue).toBe('now')
      expect(spec.$label).toBe('Date of Birth')
    })

    it('should support complex date field definition', () => {
      const spec = sb
        .date()
        .required()
        .notNull()
        .default('now')
        .label('Created At')
        .private()
        .build()

      expect(spec.$type).toBe(Date)
      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$filter?.defaultValue).toBe('now')
      expect(spec.$label).toBe('Created At')
      expect((spec.$filter as any)?.private).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.date().build()
      expect(spec.$type).toBe(Date)
      expect(spec.$validate).toBeUndefined()
      expect(spec.$filter).toBeUndefined()
    })

    it('should chain nullable and required', () => {
      const spec = sb.date().nullable().required().build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should allow nullable with default null', () => {
      const spec = sb.date().nullable().default(null).build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$filter?.defaultValue).toBeNull()
    })

    it('should handle default with timestamp', () => {
      const timestamp = Date.now()
      const spec = sb.date().default(timestamp).build()
      expect(spec.$filter?.defaultValue).toBe(timestamp)
    })
  })

  describe('common use cases', () => {
    it('should create a createdAt field with auto timestamp', () => {
      const spec = sb.date().default('now').label('Created At').build()

      expect(spec.$type).toBe(Date)
      expect(spec.$filter?.defaultValue).toBe('now')
      expect(spec.$label).toBe('Created At')
    })

    it('should create an updatedAt field', () => {
      const spec = sb.date().default('now').label('Updated At').build()

      expect(spec.$type).toBe(Date)
      expect(spec.$filter?.defaultValue).toBe('now')
      expect(spec.$label).toBe('Updated At')
    })

    it('should create a required birth date field', () => {
      const spec = sb
        .date()
        .required({ message: 'Birth date is required' })
        .notNull()
        .label('Date of Birth')
        .build()

      expect(spec.$type).toBe(Date)
      expect(spec.$validate?.required).toEqual({
        message: 'Birth date is required',
      })
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$label).toBe('Date of Birth')
    })

    it('should create an optional expiry date field', () => {
      const spec = sb.date().nullable().label('Expires At').build()

      expect(spec.$type).toBe(Date)
      expect(spec.$nullable).toBe(true)
      expect(spec.$label).toBe('Expires At')
    })

    it('should create a last login timestamp', () => {
      const spec = sb
        .date()
        .nullable()
        .default(null)
        .label('Last Login')
        .private()
        .build()

      expect(spec.$type).toBe(Date)
      expect(spec.$nullable).toBe(true)
      expect(spec.$filter?.defaultValue).toBeNull()
      expect(spec.$label).toBe('Last Login')
      expect((spec.$filter as any)?.private).toBe(true)
    })
  })

  describe('type safety', () => {
    it('should maintain correct $type after multiple chains', () => {
      const spec = sb
        .date()
        .required()
        .default('now')
        .label('Timestamp')
        .nullable()
        .private()
        .build()

      expect(spec.$type).toBe(Date)
    })
  })

  describe('default value variations', () => {
    it('should accept ISO date string as default', () => {
      const isoDate = '2024-01-15T10:30:00.000Z'
      const spec = sb.date().default(isoDate).build()
      expect(spec.$filter?.defaultValue).toBe(isoDate)
    })

    it('should accept Date object as default', () => {
      const dateObj = new Date('2024-06-15')
      const spec = sb.date().default(dateObj).build()
      expect(spec.$filter?.defaultValue).toBe(dateObj)
    })

    it('should accept special string "now" as default', () => {
      const spec = sb.date().default('now').build()
      expect(spec.$filter?.defaultValue).toBe('now')
    })
  })
})
