import { BuilderMixed } from './builder-mixed'
import { sb } from './index'
import SchemaTypes from '../types'

/**
 * Test suite for BuilderMixed class
 * Tests mixed (any) field creation and inherited validation/filter methods
 */
describe('BuilderMixed', () => {
  describe('basic creation', () => {
    it('should create a mixed field with correct type', () => {
      const spec = sb.mixed().build()
      expect(spec.$type).toBe(SchemaTypes.Mixed)
    })

    it('should create a mixed field using new BuilderMixed()', () => {
      const spec = new BuilderMixed().build()
      expect(spec.$type).toBe(SchemaTypes.Mixed)
    })

    it('should use Mixed class as type', () => {
      const spec = sb.mixed().build()
      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$type).not.toBe(String)
      expect(spec.$type).not.toBe(Number)
      expect(spec.$type).not.toBe(Object)
    })
  })

  describe('inherited validation methods', () => {
    it('should support required()', () => {
      const spec = sb.mixed().required().build()
      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support required() with options', () => {
      const options = { message: 'Field is required' }
      const spec = sb.mixed().required(options).build()
      expect(spec.$validate?.required).toEqual(options)
    })

    it('should support notNull()', () => {
      const spec = sb.mixed().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notNull() with options', () => {
      const options = { message: 'Cannot be null' }
      const spec = sb.mixed().notNull(options).build()
      expect(spec.$validate?.notNull).toEqual(options)
    })

    it('should support notEmpty()', () => {
      const spec = sb.mixed().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support isEmpty()', () => {
      const spec = sb.mixed().isEmpty().build()
      expect(spec.$validate?.isEmpty).toBe(true)
    })
  })

  describe('inherited filter methods', () => {
    it('should support default() with string', () => {
      const spec = sb.mixed().default('hello').build()
      expect(spec.$filter?.defaultValue).toBe('hello')
    })

    it('should support default() with number', () => {
      const spec = sb.mixed().default(42).build()
      expect(spec.$filter?.defaultValue).toBe(42)
    })

    it('should support default() with boolean', () => {
      const spec = sb.mixed().default(true).build()
      expect(spec.$filter?.defaultValue).toBe(true)
    })

    it('should support default() with object', () => {
      const defaultValue = { key: 'value' }
      const spec = sb.mixed().default(defaultValue).build()
      expect(spec.$filter?.defaultValue).toEqual(defaultValue)
    })

    it('should support default() with array', () => {
      const defaultValue = [1, 2, 3]
      const spec = sb.mixed().default(defaultValue).build()
      expect(spec.$filter?.defaultValue).toEqual(defaultValue)
    })

    it('should support default() with null', () => {
      const spec = sb.mixed().default(null).build()
      expect(spec.$filter?.defaultValue).toBeNull()
    })

    it('should support private()', () => {
      const spec = sb.mixed().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support private() with mode parameter', () => {
      const spec = sb.mixed().private('admin').build()
      expect((spec.$filter as any)?.private).toBe('admin')
    })

    it('should support private() with false', () => {
      const spec = sb.mixed().private(false).build()
      expect((spec.$filter as any)?.private).toBe(false)
    })

    it('should support privateValue()', () => {
      const spec = sb.mixed().privateValue().build()
      expect((spec.$filter as any)?.privateValue).toBe(true)
    })

    it('should support filter()', () => {
      const customFn = (value: any) => value !== undefined
      const spec = sb.mixed().filter(customFn).build()
      expect(spec.$filter?.callback).toBe(customFn)
    })
  })

  describe('inherited metadata methods', () => {
    it('should support label()', () => {
      const spec = sb.mixed().label('Metadata').build()
      expect(spec.$label).toBe('Metadata')
    })

    it('should support nullable()', () => {
      const spec = sb.mixed().nullable().build()
      expect(spec.$nullable).toBe(true)
    })

    it('should support relation()', () => {
      const spec = sb.mixed().relation().build()
      expect(spec.$relation).toBe(true)
    })

    it('should support relation() with false', () => {
      const spec = sb.mixed().relation(false).build()
      expect(spec.$relation).toBe(false)
    })
  })

  describe('method chaining', () => {
    it('should chain multiple validation methods', () => {
      const spec = sb.mixed().required().notNull().build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should chain validation and filter methods', () => {
      const spec = sb
        .mixed()
        .required({ message: 'Data is required' })
        .default({})
        .label('Custom Data')
        .build()

      expect(spec.$validate?.required).toEqual({ message: 'Data is required' })
      expect(spec.$filter?.defaultValue).toEqual({})
      expect(spec.$label).toBe('Custom Data')
    })

    it('should support complex mixed field definition', () => {
      const spec = sb
        .mixed()
        .required()
        .notNull()
        .default({ status: 'pending' })
        .label('Mixed Field')
        .private()
        .build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$filter?.defaultValue).toEqual({ status: 'pending' })
      expect(spec.$label).toBe('Mixed Field')
      expect((spec.$filter as any)?.private).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.mixed().build()
      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$validate).toBeUndefined()
      expect(spec.$filter).toBeUndefined()
    })

    it('should chain nullable and required', () => {
      const spec = sb.mixed().nullable().required().build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should handle default value of undefined', () => {
      const spec = sb.mixed().default(undefined).build()
      expect(spec.$filter?.defaultValue).toBeUndefined()
    })

    it('should handle default value of 0', () => {
      const spec = sb.mixed().default(0).build()
      expect(spec.$filter?.defaultValue).toBe(0)
    })

    it('should handle default value of empty string', () => {
      const spec = sb.mixed().default('').build()
      expect(spec.$filter?.defaultValue).toBe('')
    })

    it('should handle default value of false', () => {
      const spec = sb.mixed().default(false).build()
      expect(spec.$filter?.defaultValue).toBe(false)
    })
  })

  describe('common use cases', () => {
    it('should create a metadata field', () => {
      const spec = sb.mixed().default({}).label('Metadata').build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$filter?.defaultValue).toEqual({})
      expect(spec.$label).toBe('Metadata')
    })

    it('should create a flexible config field', () => {
      const spec = sb.mixed().nullable().label('Configuration').build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$nullable).toBe(true)
      expect(spec.$label).toBe('Configuration')
    })

    it('should create a custom data field', () => {
      const spec = sb
        .mixed()
        .required({ message: 'Custom data is required' })
        .label('Custom Data')
        .build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$validate?.required).toEqual({
        message: 'Custom data is required',
      })
      expect(spec.$label).toBe('Custom Data')
    })

    it('should create a private mixed field', () => {
      const spec = sb.mixed().private().label('Internal Data').build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect((spec.$filter as any)?.private).toBe(true)
      expect(spec.$label).toBe('Internal Data')
    })

    it('should create a mixed field with custom filter', () => {
      const customFn = (value: any) => {
        return value && typeof value === 'object' && 'type' in value
      }
      const spec = sb.mixed().filter(customFn).label('Polymorphic Data').build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
      expect(spec.$filter?.callback).toBe(customFn)
      expect(spec.$label).toBe('Polymorphic Data')
    })
  })

  describe('type safety', () => {
    it('should maintain correct $type after multiple chains', () => {
      const spec = sb
        .mixed()
        .required()
        .default(null)
        .label('Mixed')
        .nullable()
        .private()
        .build()

      expect(spec.$type).toBe(SchemaTypes.Mixed)
    })
  })

  describe('accepting various data types', () => {
    it('should handle nested objects as default', () => {
      const complexDefault = {
        nested: {
          deep: {
            value: 123,
          },
        },
      }
      const spec = sb.mixed().default(complexDefault).build()
      expect(spec.$filter?.defaultValue).toEqual(complexDefault)
    })

    it('should handle mixed arrays as default', () => {
      const mixedArray = [1, 'two', { three: 3 }, [4]]
      const spec = sb.mixed().default(mixedArray).build()
      expect(spec.$filter?.defaultValue).toEqual(mixedArray)
    })

    it('should handle Date objects as default', () => {
      const date = new Date('2024-01-01')
      const spec = sb.mixed().default(date).build()
      expect(spec.$filter?.defaultValue).toBe(date)
    })

    it('should handle functions as default', () => {
      const fn = () => 'test'
      const spec = sb.mixed().default(fn).build()
      expect(spec.$filter?.defaultValue).toBe(fn)
    })
  })

  describe('comparison with other types', () => {
    it('should differ from string builder', () => {
      const mixedSpec = sb.mixed().build()
      const stringSpec = sb.string().build()

      expect(mixedSpec.$type).not.toBe(stringSpec.$type)
      expect(mixedSpec.$type).toBe(SchemaTypes.Mixed)
      expect(stringSpec.$type).toBe(String)
    })

    it('should differ from object builder', () => {
      const mixedSpec = sb.mixed().build()
      const objectSpec = sb.object().build()

      expect(mixedSpec.$type).not.toBe(objectSpec.$type)
      expect(mixedSpec.$type).toBe(SchemaTypes.Mixed)
      expect(objectSpec.$type).toBe(Object)
    })
  })
})
