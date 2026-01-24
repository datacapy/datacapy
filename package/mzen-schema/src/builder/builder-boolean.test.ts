import { BuilderBoolean } from './builder-boolean'
import { sb } from './index'

/**
 * Test suite for BuilderBoolean class
 * Tests boolean field creation and inherited validation/filter methods
 */
describe('BuilderBoolean', () => {
  describe('basic creation', () => {
    it('should create a boolean field with correct type', () => {
      const spec = sb.boolean().build()
      expect(spec.$type).toBe(Boolean)
    })

    it('should create a boolean field using new BuilderBoolean()', () => {
      const spec = new BuilderBoolean().build()
      expect(spec.$type).toBe(Boolean)
    })
  })

  describe('inherited validation methods', () => {
    it('should support required()', () => {
      const spec = sb.boolean().required().build()
      expect(spec.$type).toBe(Boolean)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support required() with options', () => {
      const options = { message: 'This field is required' }
      const spec = sb.boolean().required(options).build()
      expect(spec.$validate?.required).toEqual(options)
    })

    it('should support notNull()', () => {
      const spec = sb.boolean().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notNull() with options', () => {
      const options = { message: 'Cannot be null' }
      const spec = sb.boolean().notNull(options).build()
      expect(spec.$validate?.notNull).toEqual(options)
    })

    it('should support notEmpty()', () => {
      const spec = sb.boolean().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support isEmpty()', () => {
      const spec = sb.boolean().isEmpty().build()
      expect(spec.$validate?.isEmpty).toBe(true)
    })
  })

  describe('inherited filter methods', () => {
    it('should support default() with true', () => {
      const spec = sb.boolean().default(true).build()
      expect(spec.$filter?.defaultValue).toBe(true)
    })

    it('should support default() with false', () => {
      const spec = sb.boolean().default(false).build()
      expect(spec.$filter?.defaultValue).toBe(false)
    })

    it('should support private()', () => {
      const spec = sb.boolean().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support private() with mode parameter', () => {
      const spec = sb.boolean().private('admin').build()
      expect((spec.$filter as any)?.private).toBe('admin')
    })

    it('should support private() with false', () => {
      const spec = sb.boolean().private(false).build()
      expect((spec.$filter as any)?.private).toBe(false)
    })

    it('should support privateValue()', () => {
      const spec = sb.boolean().privateValue().build()
      expect((spec.$filter as any)?.privateValue).toBe(true)
    })

    it('should support filter()', () => {
      const customFn = (value: any) => value === true
      const spec = sb.boolean().filter(customFn).build()
      expect(spec.$filter?.custom).toBe(customFn)
    })
  })

  describe('inherited metadata methods', () => {
    it('should support label()', () => {
      const spec = sb.boolean().label('Is Active').build()
      expect(spec.$label).toBe('Is Active')
    })

    it('should support nullable()', () => {
      const spec = sb.boolean().nullable().build()
      expect(spec.$nullable).toBe(true)
    })

    it('should support relation()', () => {
      const spec = sb.boolean().relation().build()
      expect(spec.$relation).toBe(true)
    })

    it('should support relation() with false', () => {
      const spec = sb.boolean().relation(false).build()
      expect(spec.$relation).toBe(false)
    })
  })

  describe('method chaining', () => {
    it('should chain multiple validation methods', () => {
      const spec = sb.boolean().required().notNull().build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should chain validation and filter methods', () => {
      const spec = sb
        .boolean()
        .required({ message: 'Agreement is required' })
        .default(false)
        .label('Terms Accepted')
        .build()

      expect(spec.$validate?.required).toEqual({
        message: 'Agreement is required',
      })
      expect(spec.$filter?.defaultValue).toBe(false)
      expect(spec.$label).toBe('Terms Accepted')
    })

    it('should support complex boolean field definition', () => {
      const spec = sb
        .boolean()
        .required()
        .notNull()
        .default(false)
        .label('Email Notifications')
        .build()

      expect(spec.$type).toBe(Boolean)
      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$filter?.defaultValue).toBe(false)
      expect(spec.$label).toBe('Email Notifications')
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.boolean().build()
      expect(spec.$type).toBe(Boolean)
      expect(spec.$validate).toBeUndefined()
      expect(spec.$filter).toBeUndefined()
    })

    it('should handle default value explicitly set to false', () => {
      const spec = sb.boolean().default(false).build()
      expect(spec.$filter?.defaultValue).toBe(false)
    })

    it('should chain nullable and required', () => {
      const spec = sb.boolean().nullable().required().build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should allow nullable with default null', () => {
      const spec = sb.boolean().nullable().default(null).build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$filter?.defaultValue).toBeNull()
    })
  })

  describe('common use cases', () => {
    it('should create a checkbox field with default false', () => {
      const spec = sb
        .boolean()
        .default(false)
        .label('Subscribe to newsletter')
        .build()

      expect(spec.$type).toBe(Boolean)
      expect(spec.$filter?.defaultValue).toBe(false)
      expect(spec.$label).toBe('Subscribe to newsletter')
    })

    it('should create a required acceptance field', () => {
      const spec = sb
        .boolean()
        .required({ message: 'You must accept the terms' })
        .label('Accept Terms and Conditions')
        .build()

      expect(spec.$type).toBe(Boolean)
      expect(spec.$validate?.required).toEqual({
        message: 'You must accept the terms',
      })
      expect(spec.$label).toBe('Accept Terms and Conditions')
    })

    it('should create a feature flag field', () => {
      const spec = sb
        .boolean()
        .default(false)
        .label('Dark Mode Enabled')
        .private()
        .build()

      expect(spec.$type).toBe(Boolean)
      expect(spec.$filter?.defaultValue).toBe(false)
      expect(spec.$label).toBe('Dark Mode Enabled')
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should create a status flag with nullable', () => {
      const spec = sb
        .boolean()
        .nullable()
        .default(null)
        .label('Email Verified')
        .build()

      expect(spec.$type).toBe(Boolean)
      expect(spec.$nullable).toBe(true)
      expect(spec.$filter?.defaultValue).toBeNull()
      expect(spec.$label).toBe('Email Verified')
    })
  })

  describe('type safety', () => {
    it('should maintain correct $type after multiple chains', () => {
      const spec = sb
        .boolean()
        .required()
        .default(true)
        .label('Active')
        .nullable()
        .private()
        .build()

      expect(spec.$type).toBe(Boolean)
    })
  })
})
