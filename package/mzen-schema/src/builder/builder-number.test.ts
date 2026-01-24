import { BuilderNumber } from './builder-number'
import { sb } from './index'

/**
 * Test suite for BuilderNumber class
 * Tests number field creation and inherited validation/filter methods
 */
describe('BuilderNumber', () => {
  describe('basic creation', () => {
    it('should create a number field with correct type', () => {
      const spec = sb.number().build()
      expect(spec.$type).toBe(Number)
    })

    it('should create a number field using new BuilderNumber()', () => {
      const spec = new BuilderNumber().build()
      expect(spec.$type).toBe(Number)
    })
  })

  describe('inherited validation methods', () => {
    it('should support required()', () => {
      const spec = sb.number().required().build()
      expect(spec.$type).toBe(Number)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support required() with options', () => {
      const options = { message: 'Number is required' }
      const spec = sb.number().required(options).build()
      expect(spec.$validate?.required).toEqual(options)
    })

    it('should support notNull()', () => {
      const spec = sb.number().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notNull() with options', () => {
      const options = { message: 'Cannot be null' }
      const spec = sb.number().notNull(options).build()
      expect(spec.$validate?.notNull).toEqual(options)
    })

    it('should support notEmpty()', () => {
      const spec = sb.number().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support isEmpty()', () => {
      const spec = sb.number().isEmpty().build()
      expect(spec.$validate?.isEmpty).toBe(true)
    })
  })

  describe('inherited filter methods', () => {
    it('should support default()', () => {
      const spec = sb.number().default(0).build()
      expect(spec.$filter?.defaultValue).toBe(0)
    })

    it('should support default() with different values', () => {
      const spec = sb.number().default(42).build()
      expect(spec.$filter?.defaultValue).toBe(42)
    })

    it('should support private()', () => {
      const spec = sb.number().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support private() with mode parameter', () => {
      const spec = sb.number().private('admin').build()
      expect((spec.$filter as any)?.private).toBe('admin')
    })

    it('should support private() with false', () => {
      const spec = sb.number().private(false).build()
      expect((spec.$filter as any)?.private).toBe(false)
    })

    it('should support privateValue()', () => {
      const spec = sb.number().privateValue().build()
      expect((spec.$filter as any)?.privateValue).toBe(true)
    })

    it('should support filter()', () => {
      const customFn = (value: any) => value > 0
      const spec = sb.number().filter(customFn).build()
      expect(spec.$filter?.custom).toBe(customFn)
    })
  })

  describe('inherited metadata methods', () => {
    it('should support label()', () => {
      const spec = sb.number().label('Age').build()
      expect(spec.$label).toBe('Age')
    })

    it('should support nullable()', () => {
      const spec = sb.number().nullable().build()
      expect(spec.$nullable).toBe(true)
    })

    it('should support relation()', () => {
      const spec = sb.number().relation().build()
      expect(spec.$relation).toBe(true)
    })

    it('should support relation() with false', () => {
      const spec = sb.number().relation(false).build()
      expect(spec.$relation).toBe(false)
    })
  })

  describe('method chaining', () => {
    it('should chain multiple validation methods', () => {
      const spec = sb.number().required().notNull().notEmpty().build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should chain validation and filter methods', () => {
      const spec = sb
        .number()
        .required({ message: 'Age is required' })
        .default(18)
        .label('Age')
        .build()

      expect(spec.$validate?.required).toEqual({ message: 'Age is required' })
      expect(spec.$filter?.defaultValue).toBe(18)
      expect(spec.$label).toBe('Age')
    })

    it('should support complex number field definition', () => {
      const spec = sb
        .number()
        .required()
        .notNull()
        .default(0)
        .label('Score')
        .private()
        .build()

      expect(spec.$type).toBe(Number)
      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$filter?.defaultValue).toBe(0)
      expect(spec.$label).toBe('Score')
      expect((spec.$filter as any)?.private).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.number().build()
      expect(spec.$type).toBe(Number)
      expect(spec.$validate).toBeUndefined()
      expect(spec.$filter).toBeUndefined()
    })

    it('should handle default value of 0', () => {
      const spec = sb.number().default(0).build()
      expect(spec.$filter?.defaultValue).toBe(0)
    })

    it('should handle negative default values', () => {
      const spec = sb.number().default(-1).build()
      expect(spec.$filter?.defaultValue).toBe(-1)
    })

    it('should handle floating point default values', () => {
      const spec = sb.number().default(3.14159).build()
      expect(spec.$filter?.defaultValue).toBe(3.14159)
    })

    it('should chain nullable and required', () => {
      const spec = sb.number().nullable().required().build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
    })
  })

  describe('type safety', () => {
    it('should maintain correct $type after multiple chains', () => {
      const spec = sb
        .number()
        .required()
        .default(10)
        .label('Count')
        .nullable()
        .private()
        .build()

      expect(spec.$type).toBe(Number)
    })
  })
})
