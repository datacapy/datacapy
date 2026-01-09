import { BuilderArray } from './builder-array'
import { sb } from './index'

/**
 * Test suite for BuilderArray class
 * Tests array-specific methods and inherited validation/filter methods
 */
describe('BuilderArray', () => {
  describe('basic creation', () => {
    it('should create an array field with correct type', () => {
      const spec = sb.array().build()
      expect(spec.$type).toBe(Array)
    })

    it('should create an array field using new BuilderArray()', () => {
      const spec = new BuilderArray().build()
      expect(spec.$type).toBe(Array)
    })
  })

  describe('array-specific methods', () => {
    describe('of()', () => {
      it('should set array item spec with SchemaSpec', () => {
        const itemSpec = { $type: String }
        const spec = sb.array().of(itemSpec).build()
        expect(spec.$spec).toEqual(itemSpec)
      })

      it('should set array item spec with builder instance', () => {
        const spec = sb.array().of(sb.string().required()).build()
        expect(spec.$spec?.$type).toBe(String)
        expect(spec.$spec?.$validate?.required).toBe(true)
      })

      it('should handle nested array specs', () => {
        const spec = sb.array().of(sb.array().of({ $type: Number })).build()
        expect(spec.$spec?.$type).toBe(Array)
        expect(spec.$spec?.$spec?.$type).toBe(Number)
      })

      it('should handle object item specs', () => {
        const spec = sb.array().of({
          $type: Object,
          $spec: {
            id: { $type: String },
            name: { $type: String },
          },
        }).build()

        expect(spec.$spec?.$type).toBe(Object)
        expect(spec.$spec?.$spec?.id?.$type).toBe(String)
        expect(spec.$spec?.$spec?.name?.$type).toBe(String)
      })

      it('should handle object builder as item spec', () => {
        const spec = sb.array()
          .of(
            sb.object().shape({
              id: sb.string().required(),
              count: sb.number().default(0),
            })
          )
          .build()

        expect(spec.$spec?.$type).toBe(Object)
        expect(spec.$spec?.id?.$type).toBe(String)
        expect(spec.$spec?.id?.$validate?.required).toBe(true)
        expect(spec.$spec?.count?.$type).toBe(Number)
        expect(spec.$spec?.count?.$filter?.defaultValue).toBe(0)
      })
    })

    describe('ofSchema()', () => {
      it('should set schema reference for array items', () => {
        const spec = sb.array().ofSchema('surveyQuestion').build()
        expect(spec.$spec?.$schema).toBe('surveyQuestion')
      })

      it('should create shorthand for schema references', () => {
        const spec = sb.array().ofSchema('user').build()
        expect(spec.$spec).toEqual({ $schema: 'user' })
      })
    })

    describe('construct()', () => {
      it('should set constructor as string', () => {
        const spec = sb.array().construct('MyClass').build()
        expect(spec.$construct).toBe('MyClass')
      })

      it('should set constructor as function', () => {
        class MyClass {}
        const spec = sb.array().construct(MyClass).build()
        expect(spec.$construct).toBe(MyClass)
      })
    })

    describe('constructCollection()', () => {
      it('should set collection constructor as string', () => {
        const spec = sb.array().constructCollection('Collection').build()
        expect(spec.$constructCollection).toBe('Collection')
      })

      it('should set collection constructor as function', () => {
        class Collection {}
        const spec = sb.array().constructCollection(Collection).build()
        expect(spec.$constructCollection).toBe(Collection)
      })
    })
  })

  describe('inherited validation methods', () => {
    it('should support required()', () => {
      const spec = sb.array().required().build()
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support notNull()', () => {
      const spec = sb.array().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notEmpty()', () => {
      const spec = sb.array().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support isEmpty()', () => {
      const spec = sb.array().isEmpty().build()
      expect(spec.$validate?.isEmpty).toBe(true)
    })
  })

  describe('inherited filter methods', () => {
    it('should support default()', () => {
      const spec = sb.array().default([]).build()
      expect(spec.$filter?.defaultValue).toEqual([])
    })

    it('should support default() with values', () => {
      const defaultValue = [1, 2, 3]
      const spec = sb.array().default(defaultValue).build()
      expect(spec.$filter?.defaultValue).toEqual(defaultValue)
    })

    it('should support private()', () => {
      const spec = sb.array().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support custom()', () => {
      const customFn = (value: any) => Array.isArray(value)
      const spec = sb.array().custom(customFn).build()
      expect(spec.$filter?.custom).toBe(customFn)
    })
  })

  describe('inherited metadata methods', () => {
    it('should support label()', () => {
      const spec = sb.array().label('Tags').build()
      expect(spec.$label).toBe('Tags')
    })

    it('should support nullable()', () => {
      const spec = sb.array().nullable().build()
      expect(spec.$nullable).toBe(true)
    })

    it('should support relation()', () => {
      const spec = sb.array().relation().build()
      expect(spec.$relation).toBe(true)
    })
  })

  describe('method chaining', () => {
    it('should chain array-specific methods', () => {
      const spec = sb.array()
        .of({ $type: String })
        .construct('Tag')
        .constructCollection('TagCollection')
        .build()

      expect(spec.$spec?.$type).toBe(String)
      expect(spec.$construct).toBe('Tag')
      expect(spec.$constructCollection).toBe('TagCollection')
    })

    it('should chain validation and filter methods', () => {
      const spec = sb.array()
        .required()
        .notEmpty()
        .default([])
        .label('Items')
        .build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notEmpty).toBe(true)
      expect(spec.$filter?.defaultValue).toEqual([])
      expect(spec.$label).toBe('Items')
    })

    it('should chain array methods with validation', () => {
      const spec = sb.array()
        .ofSchema('product')
        .required()
        .notEmpty()
        .relation()
        .build()

      expect(spec.$spec?.$schema).toBe('product')
      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notEmpty).toBe(true)
      expect(spec.$relation).toBe(true)
    })

    it('should support complex array definition', () => {
      const spec = sb.array()
        .required({ message: 'At least one item is required' })
        .notEmpty()
        .of(sb.string().trim().maxLength(50))
        .label('Tags')
        .default([])
        .build()

      expect(spec.$type).toBe(Array)
      expect(spec.$validate?.required).toEqual({ message: 'At least one item is required' })
      expect(spec.$validate?.notEmpty).toBe(true)
      expect(spec.$spec?.$type).toBe(String)
      expect(spec.$spec?.$filter?.trim).toBe(true)
      expect(spec.$spec?.$validate?.valueLength?.max).toBe(50)
      expect(spec.$label).toBe('Tags')
      expect(spec.$filter?.defaultValue).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.array().build()
      expect(spec.$type).toBe(Array)
      expect(spec.$spec).toBeUndefined()
    })

    it('should chain nullable and required', () => {
      const spec = sb.array().nullable().required().build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should handle nullable with default null', () => {
      const spec = sb.array().nullable().default(null).build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$filter?.defaultValue).toBeNull()
    })

    it('should overwrite of() when called multiple times', () => {
      const spec = sb.array()
        .of({ $type: String })
        .of({ $type: Number })
        .build()

      expect(spec.$spec?.$type).toBe(Number)
    })

    it('should allow ofSchema() to replace of()', () => {
      const spec = sb.array()
        .of({ $type: String })
        .ofSchema('user')
        .build()

      expect(spec.$spec?.$schema).toBe('user')
      expect(spec.$spec?.$type).toBeUndefined()
    })
  })

  describe('common use cases', () => {
    it('should create an array of strings', () => {
      const spec = sb.array()
        .of({ $type: String })
        .label('Tags')
        .build()

      expect(spec.$type).toBe(Array)
      expect(spec.$spec?.$type).toBe(String)
      expect(spec.$label).toBe('Tags')
    })

    it('should create an array of schema references', () => {
      const spec = sb.array()
        .ofSchema('comment')
        .relation()
        .label('Comments')
        .build()

      expect(spec.$type).toBe(Array)
      expect(spec.$spec?.$schema).toBe('comment')
      expect(spec.$relation).toBe(true)
      expect(spec.$label).toBe('Comments')
    })

    it('should create an array with custom collection class', () => {
      const spec = sb.array()
        .ofSchema('userClient')
        .relation()
        .private()
        .construct('UserClient')
        .constructCollection('Collection')
        .build()

      expect(spec.$spec?.$schema).toBe('userClient')
      expect(spec.$relation).toBe(true)
      expect((spec.$filter as any)?.private).toBe(true)
      expect(spec.$construct).toBe('UserClient')
      expect(spec.$constructCollection).toBe('Collection')
    })

    it('should create a required non-empty array', () => {
      const spec = sb.array()
        .required({ message: 'Please select at least one option' })
        .notEmpty({ message: 'Array cannot be empty' })
        .of({ $type: String })
        .build()

      expect(spec.$validate?.required).toEqual({ message: 'Please select at least one option' })
      expect(spec.$validate?.notEmpty).toEqual({ message: 'Array cannot be empty' })
      expect(spec.$spec?.$type).toBe(String)
    })

    it('should create an array with complex object items', () => {
      const spec = sb.array()
        .of(
          sb.object().shape({
            id: sb.string().required(),
            name: sb.string().required().trim(),
            active: sb.boolean().default(true),
          })
        )
        .label('Users')
        .build()

      expect(spec.$type).toBe(Array)
      expect(spec.$spec?.$type).toBe(Object)
      expect(spec.$spec?.id?.$type).toBe(String)
      expect(spec.$spec?.name?.$filter?.trim).toBe(true)
      expect(spec.$spec?.active?.$filter?.defaultValue).toBe(true)
    })
  })

  describe('type safety', () => {
    it('should maintain correct $type after multiple chains', () => {
      const spec = sb.array()
        .of({ $type: String })
        .required()
        .label('Items')
        .nullable()
        .private()
        .build()

      expect(spec.$type).toBe(Array)
    })
  })

  describe('nested arrays', () => {
    it('should handle nested arrays', () => {
      const spec = sb.array()
        .of(
          sb.array().of({ $type: Number })
        )
        .build()

      expect(spec.$type).toBe(Array)
      expect(spec.$spec?.$type).toBe(Array)
      expect(spec.$spec?.$spec?.$type).toBe(Number)
    })

    it('should handle deeply nested structures', () => {
      const spec = sb.array()
        .of(
          sb.object().shape({
            matrix: sb.array().of(
              sb.array().of({ $type: Number })
            ),
          })
        )
        .build()

      expect(spec.$type).toBe(Array)
      expect(spec.$spec?.matrix?.$type).toBe(Array)
      expect(spec.$spec?.matrix?.$spec?.$type).toBe(Array)
      expect(spec.$spec?.matrix?.$spec?.$spec?.$type).toBe(Number)
    })
  })
})
