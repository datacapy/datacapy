import { sb } from './index'

/**
 * Test suite for BuilderBase class
 * Tests common validation, filter, and metadata methods inherited by all builders
 * Since BuilderBase is abstract, we test through concrete implementations (string builder)
 */
describe('BuilderBase', () => {
  describe('validation methods', () => {
    describe('required()', () => {
      it('should set required to true by default', () => {
        const spec = sb.string().required().build()
        expect(spec.$validate?.required).toBe(true)
      })

      it('should accept options object', () => {
        const options = { message: 'This field is required' }
        const spec = sb.string().required(options).build()
        expect(spec.$validate?.required).toEqual(options)
      })

      it('should work with complex options', () => {
        const options = { message: 'Required', code: 'REQUIRED_FIELD' }
        const spec = sb.number().required(options).build()
        expect(spec.$validate?.required).toEqual(options)
      })
    })

    describe('notNull()', () => {
      it('should set notNull to true by default', () => {
        const spec = sb.string().notNull().build()
        expect(spec.$validate?.notNull).toBe(true)
      })

      it('should accept options object', () => {
        const options = { message: 'Cannot be null' }
        const spec = sb.string().notNull(options).build()
        expect(spec.$validate?.notNull).toEqual(options)
      })
    })

    describe('notEmpty()', () => {
      it('should set notEmpty to true by default', () => {
        const spec = sb.string().notEmpty().build()
        expect(spec.$validate?.notEmpty).toBe(true)
      })

      it('should accept options object', () => {
        const options = { message: 'Cannot be empty' }
        const spec = sb.array().notEmpty(options).build()
        expect(spec.$validate?.notEmpty).toEqual(options)
      })
    })

    describe('isEmpty()', () => {
      it('should set isEmpty to true by default', () => {
        const spec = sb.string().isEmpty().build()
        expect(spec.$validate?.isEmpty).toBe(true)
      })

      it('should accept options object', () => {
        const options = { message: 'Must be empty' }
        const spec = sb.string().isEmpty(options).build()
        expect(spec.$validate?.isEmpty).toEqual(options)
      })
    })

    describe('remote()', () => {
      it('should set remote validation options', () => {
        const options = { url: '/api/validate' }
        const spec = sb.string().remote(options).build()
        expect(spec.$validate?.remote).toEqual(options)
      })

      it('should accept full options object', () => {
        const options = {
          url: '/api/validate/username',
          method: 'POST',
          params: { type: 'username' },
          paramPaths: { companyId: 'company.id' },
          data: { context: 'registration' },
          dataPaths: { userId: 'user.id' },
          timeout: 10000,
        }
        const spec = sb.string().remote(options).build()
        expect(spec.$validate?.remote).toEqual(options)
      })

      it('should work with other validations', () => {
        const spec = sb
          .string()
          .required()
          .remote({ url: '/api/validate' })
          .build()

        expect(spec.$validate?.required).toBe(true)
        expect(spec.$validate?.remote).toEqual({ url: '/api/validate' })
      })
    })

    describe('validation method combinations', () => {
      it('should allow multiple validation methods on same field', () => {
        const spec = sb.string().required().notNull().notEmpty().build()

        expect(spec.$validate?.required).toBe(true)
        expect(spec.$validate?.notNull).toBe(true)
        expect(spec.$validate?.notEmpty).toBe(true)
      })

      it('should create $validate object only when needed', () => {
        const spec = sb.string().build()
        expect(spec.$validate).toBeUndefined()
      })
    })
  })

  describe('filter methods', () => {
    describe('default()', () => {
      it('should set default value', () => {
        const spec = sb.string().default('hello').build()
        expect(spec.$filter?.defaultValue).toBe('hello')
      })

      it('should accept null as default', () => {
        const spec = sb.string().default(null).build()
        expect(spec.$filter?.defaultValue).toBeNull()
      })

      it('should accept undefined as default', () => {
        const spec = sb.string().default(undefined).build()
        expect(spec.$filter?.defaultValue).toBeUndefined()
      })

      it('should accept objects as default', () => {
        const defaultValue = { key: 'value' }
        const spec = sb.object().default(defaultValue).build()
        expect(spec.$filter?.defaultValue).toEqual(defaultValue)
      })

      it('should accept arrays as default', () => {
        const defaultValue = [1, 2, 3]
        const spec = sb.array().default(defaultValue).build()
        expect(spec.$filter?.defaultValue).toEqual(defaultValue)
      })

      it('should accept falsy values as default', () => {
        expect(sb.number().default(0).build().$filter?.defaultValue).toBe(0)
        expect(sb.string().default('').build().$filter?.defaultValue).toBe('')
        expect(sb.boolean().default(false).build().$filter?.defaultValue).toBe(
          false
        )
      })
    })

    describe('private()', () => {
      it('should set private to true by default', () => {
        const spec = sb.string().private().build()
        expect((spec.$filter as any)?.private).toBe(true)
      })

      it('should accept boolean parameter', () => {
        const spec = sb.string().private(false).build()
        expect((spec.$filter as any)?.private).toBe(false)
      })

      it('should accept string mode parameter', () => {
        const spec = sb.string().private('admin').build()
        expect((spec.$filter as any)?.private).toBe('admin')
      })

      it('should handle different mode values', () => {
        expect(
          (sb.string().private('user').build().$filter as any)?.private
        ).toBe('user')
        expect(
          (sb.string().private('owner').build().$filter as any)?.private
        ).toBe('owner')
      })
    })

    describe('privateValue()', () => {
      it('should set privateValue to true by default', () => {
        const spec = sb.string().privateValue().build()
        expect((spec.$filter as any)?.privateValue).toBe(true)
      })

      it('should accept boolean parameter', () => {
        const spec = sb.string().privateValue(false).build()
        expect((spec.$filter as any)?.privateValue).toBe(false)
      })

      it('should accept string mode parameter', () => {
        const spec = sb.string().privateValue('admin').build()
        expect((spec.$filter as any)?.privateValue).toBe('admin')
      })
    })

    describe('filter()', () => {
      it('should set custom filter function', () => {
        const customFn = (value: any) => value.toUpperCase()
        const spec = sb.string().filter(customFn).build()
        expect(spec.$filter?.custom).toBe(customFn)
      })

      it('should accept arrow functions', () => {
        const customFn = (value: any) => value > 0
        const spec = sb.number().filter(customFn).build()
        expect(spec.$filter?.custom).toBe(customFn)
      })

      it('should accept any function signature', () => {
        const customFn = function (value: any) {
          return value !== null
        }
        const spec = sb.mixed().filter(customFn).build()
        expect(spec.$filter?.custom).toBe(customFn)
      })
    })

    describe('filter method combinations', () => {
      it('should allow multiple filter methods on same field', () => {
        const customFn = () => true
        const spec = sb
          .string()
          .default('test')
          .private()
          .filter(customFn)
          .build()

        expect(spec.$filter?.defaultValue).toBe('test')
        expect((spec.$filter as any)?.private).toBe(true)
        expect(spec.$filter?.custom).toBe(customFn)
      })

      it('should create $filter object only when needed', () => {
        const spec = sb.string().build()
        expect(spec.$filter).toBeUndefined()
      })
    })
  })

  describe('metadata methods', () => {
    describe('label()', () => {
      it('should set field label', () => {
        const spec = sb.string().label('Email Address').build()
        expect(spec.$label).toBe('Email Address')
      })

      it('should accept any string', () => {
        expect(sb.string().label('First Name').build().$label).toBe(
          'First Name'
        )
        expect(sb.number().label('Age').build().$label).toBe('Age')
        expect(sb.boolean().label('Is Active').build().$label).toBe('Is Active')
      })
    })

    describe('nullable()', () => {
      it('should set nullable to true', () => {
        const spec = sb.string().nullable().build()
        expect(spec.$nullable).toBe(true)
      })

      it('should work with all field types', () => {
        expect(sb.string().nullable().build().$nullable).toBe(true)
        expect(sb.number().nullable().build().$nullable).toBe(true)
        expect(sb.boolean().nullable().build().$nullable).toBe(true)
        expect(sb.date().nullable().build().$nullable).toBe(true)
        expect(sb.array().nullable().build().$nullable).toBe(true)
        expect(sb.object().nullable().build().$nullable).toBe(true)
        expect(sb.mixed().nullable().build().$nullable).toBe(true)
      })

      it('should combine with required validation', () => {
        const spec = sb.string().required().nullable().build()
        expect(spec.$validate?.required).toBe(true)
        expect(spec.$nullable).toBe(true)
      })
    })

    describe('relation()', () => {
      it('should set relation to true by default', () => {
        const spec = sb.object().relation().build()
        expect(spec.$relation).toBe(true)
      })

      it('should accept explicit true', () => {
        const spec = sb.array().relation(true).build()
        expect(spec.$relation).toBe(true)
      })

      it('should accept false', () => {
        const spec = sb.object().relation(false).build()
        expect(spec.$relation).toBe(false)
      })

      it('should work with all field types', () => {
        expect(sb.object().relation().build().$relation).toBe(true)
        expect(sb.array().relation().build().$relation).toBe(true)
        expect(sb.string().relation().build().$relation).toBe(true)
      })
    })
  })

  describe('build method', () => {
    describe('basic building', () => {
      it('should include $type in built spec', () => {
        expect(sb.string().build().$type).toBe(String)
        expect(sb.number().build().$type).toBe(Number)
        expect(sb.boolean().build().$type).toBe(Boolean)
        expect(sb.date().build().$type).toBe(Date)
        expect(sb.array().build().$type).toBe(Array)
        expect(sb.object().build().$type).toBe(Object)
      })

      it('should build empty spec for builder with no methods called', () => {
        const spec = sb.string().build()
        expect(spec.$type).toBe(String)
        expect(spec.$validate).toBeUndefined()
        expect(spec.$filter).toBeUndefined()
      })
    })

    describe('buildValue recursion', () => {
      it('should recursively build nested builder instances', () => {
        const spec = sb
          .object()
          .shape({
            user: sb.object().shape({
              name: sb.string().required(),
            }),
          })
          .build()

        expect(spec.user?.$type).toBe(Object)
        expect(spec.user?.name?.$type).toBe(String)
        expect(spec.user?.name?.$validate?.required).toBe(true)
      })

      it('should recursively build builders in arrays', () => {
        const spec = sb.array().of(sb.string().required()).build()

        expect(spec.$spec?.$type).toBe(String)
        expect(spec.$spec?.$validate?.required).toBe(true)
      })

      it('should recursively process plain object values', () => {
        const spec = sb
          .object()
          .shape({
            nested: {
              field: sb.string().required(),
            },
          })
          .build()

        expect(spec.nested?.field?.$type).toBe(String)
        expect(spec.nested?.field?.$validate?.required).toBe(true)
      })

      it('should handle deeply nested structures', () => {
        const spec = sb
          .object()
          .shape({
            level1: sb.object().shape({
              level2: sb.object().shape({
                level3: sb.string().required(),
              }),
            }),
          })
          .build()

        expect(spec.level1?.level2?.level3?.$validate?.required).toBe(true)
      })

      it('should handle arrays of builders', () => {
        const builders = [sb.string(), sb.number()]

        const spec = sb.or(builders).build()
        expect(spec.$or?.[0].$type).toBe(String)
        expect(spec.$or?.[1].$type).toBe(Number)
      })
    })

    describe('building with all features', () => {
      it('should build spec with validation, filters, and metadata', () => {
        const spec = sb
          .string()
          .required({ message: 'Required' })
          .notNull()
          .default('test')
          .label('Field')
          .nullable()
          .build()

        expect(spec.$type).toBe(String)
        expect(spec.$validate?.required).toEqual({ message: 'Required' })
        expect(spec.$validate?.notNull).toBe(true)
        expect(spec.$filter?.defaultValue).toBe('test')
        expect(spec.$label).toBe('Field')
        expect(spec.$nullable).toBe(true)
      })
    })
  })

  describe('method chaining', () => {
    it('should return this for all builder methods', () => {
      const builder = sb.string()
      expect(builder.required()).toBe(builder)
      expect(builder.notNull()).toBe(builder)
      expect(builder.default('test')).toBe(builder)
      expect(builder.label('Test')).toBe(builder)
      expect(builder.nullable()).toBe(builder)
    })

    it('should allow arbitrary chaining order', () => {
      const spec1 = sb.string().required().default('test').label('A').build()
      const spec2 = sb.string().label('A').default('test').required().build()
      const spec3 = sb.string().default('test').label('A').required().build()

      expect(spec1.$validate?.required).toBe(true)
      expect(spec2.$validate?.required).toBe(true)
      expect(spec3.$validate?.required).toBe(true)

      expect(spec1.$filter?.defaultValue).toBe('test')
      expect(spec2.$filter?.defaultValue).toBe('test')
      expect(spec3.$filter?.defaultValue).toBe('test')

      expect(spec1.$label).toBe('A')
      expect(spec2.$label).toBe('A')
      expect(spec3.$label).toBe('A')
    })

    it('should allow long chains', () => {
      const spec = sb
        .string()
        .required()
        .notNull()
        .notEmpty()
        .default('test')
        .label('Long Chain')
        .nullable()
        .private()
        .build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$validate?.notEmpty).toBe(true)
      expect(spec.$filter?.defaultValue).toBe('test')
      expect(spec.$label).toBe('Long Chain')
      expect(spec.$nullable).toBe(true)
      expect((spec.$filter as any)?.private).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle overwriting values', () => {
      const spec = sb.string().default('first').default('second').build()

      expect(spec.$filter?.defaultValue).toBe('second')
    })

    it('should handle calling same method multiple times', () => {
      const spec = sb.string().label('First').label('Second').build()

      expect(spec.$label).toBe('Second')
    })

    it('should preserve immutability of builder', () => {
      const builder = sb.string()
      const spec1 = builder.required().build()
      const spec2 = builder.build()

      // Both should have required since the builder instance is mutated
      expect(spec1.$validate?.required).toBe(true)
      expect(spec2.$validate?.required).toBe(true)
    })
  })

  describe('type preservation', () => {
    it('should preserve type through chaining', () => {
      const spec = sb
        .string()
        .required()
        .notNull()
        .default('test')
        .nullable()
        .private()
        .label('Test')
        .build()

      expect(spec.$type).toBe(String)
    })

    it('should work with all concrete types', () => {
      const types = [
        sb.string(),
        sb.number(),
        sb.boolean(),
        sb.date(),
        sb.array(),
        sb.object(),
        sb.mixed(),
      ]

      types.forEach((builder) => {
        const spec = builder.required().nullable().label('Test').build()

        expect(spec.$type).toBeDefined()
        expect(spec.$validate?.required).toBe(true)
        expect(spec.$nullable).toBe(true)
      })
    })
  })
})
