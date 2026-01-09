import { BuilderObject } from './builder-object'
import { sb } from './index'

/**
 * Test suite for BuilderObject class
 * Tests object-specific methods and inherited validation/filter methods
 */
describe('BuilderObject', () => {
  describe('basic creation', () => {
    it('should create an object field with correct type', () => {
      const spec = sb.object().build()
      expect(spec.$type).toBe(Object)
    })

    it('should create an object field using new BuilderObject()', () => {
      const spec = new BuilderObject().build()
      expect(spec.$type).toBe(Object)
    })
  })

  describe('object-specific methods', () => {
    describe('shape()', () => {
      it('should define object shape with SchemaSpecs', () => {
        const spec = sb
          .object()
          .shape({
            name: { $type: String },
            age: { $type: Number },
          })
          .build()

        expect(spec.name?.$type).toBe(String)
        expect(spec.age?.$type).toBe(Number)
      })

      it('should define object shape with builder instances', () => {
        const spec = sb
          .object()
          .shape({
            email: sb.string().email().required(),
            count: sb.number().default(0),
          })
          .build()

        expect(spec.email?.$type).toBe(String)
        expect(spec.email?.$validate?.email).toBe(true)
        expect(spec.email?.$validate?.required).toBe(true)
        expect(spec.count?.$type).toBe(Number)
        expect(spec.count?.$filter?.defaultValue).toBe(0)
      })

      it('should handle nested objects in shape', () => {
        const spec = sb
          .object()
          .shape({
            user: sb.object().shape({
              id: sb.string().required(),
              name: sb.string(),
            }),
          })
          .build()

        expect(spec.user?.$type).toBe(Object)
        expect(spec.user?.id?.$type).toBe(String)
        expect(spec.user?.id?.$validate?.required).toBe(true)
        expect(spec.user?.name?.$type).toBe(String)
      })

      it('should handle arrays in shape', () => {
        const spec = sb
          .object()
          .shape({
            tags: sb.array().of({ $type: String }),
            scores: sb.array().of({ $type: Number }),
          })
          .build()

        expect(spec.tags?.$type).toBe(Array)
        expect(spec.tags?.$spec?.$type).toBe(String)
        expect(spec.scores?.$type).toBe(Array)
        expect(spec.scores?.$spec?.$type).toBe(Number)
      })

      it('should allow shape to be called multiple times (merging)', () => {
        const spec = sb
          .object()
          .shape({ name: sb.string() })
          .shape({ age: sb.number() })
          .build()

        expect(spec.name?.$type).toBe(String)
        expect(spec.age?.$type).toBe(Number)
      })

      it('should skip undefined values in shape', () => {
        const spec = sb
          .object()
          .shape({
            name: sb.string(),
            deleted: undefined,
          })
          .build()

        expect(spec.name).toBeDefined()
        expect(spec.deleted).toBeUndefined()
      })
    })

    describe('matchAll()', () => {
      it('should set match-all spec with SchemaSpec', () => {
        const spec = sb.object().matchAll({ $type: String }).build()

        expect(spec['*']).toEqual({ $type: String })
      })

      it('should set match-all spec with builder instance', () => {
        const spec = sb
          .object()
          .matchAll(sb.string().trim().maxLength(100))
          .build()

        expect(spec['*'].$type).toBe(String)
        expect(spec['*'].$filter?.trim).toBe(true)
        expect(spec['*'].$validate?.valueLength?.max).toBe(100)
      })

      it('should combine with shape', () => {
        const spec = sb
          .object()
          .shape({
            id: sb.string().required(),
          })
          .matchAll(sb.string())
          .build()

        expect(spec.id?.$type).toBe(String)
        expect(spec.id?.$validate?.required).toBe(true)
        expect(spec['*'].$type).toBe(String)
      })
    })

    describe('schema()', () => {
      it('should set schema reference', () => {
        const spec = sb.object().schema('user').build()

        expect(spec.$schema).toBe('user')
      })

      it('should combine with other methods', () => {
        const spec = sb.object().schema('l10n').nullable().build()

        expect(spec.$schema).toBe('l10n')
        expect(spec.$nullable).toBe(true)
      })
    })

    describe('strict()', () => {
      it('should enable strict mode by default', () => {
        const spec = sb.object().strict().build()

        expect(spec.$strict).toBe(true)
      })

      it('should enable strict mode with explicit true', () => {
        const spec = sb.object().strict(true).build()

        expect(spec.$strict).toBe(true)
      })

      it('should disable strict mode with false', () => {
        const spec = sb.object().strict(false).build()

        expect(spec.$strict).toBe(false)
      })

      it('should combine strict with shape', () => {
        const spec = sb
          .object()
          .shape({
            name: sb.string().required(),
          })
          .strict()
          .build()

        expect(spec.$strict).toBe(true)
        expect(spec.name?.$validate?.required).toBe(true)
      })
    })

    describe('construct()', () => {
      it('should set constructor as string', () => {
        const spec = sb.object().construct('User').build()

        expect(spec.$construct).toBe('User')
      })

      it('should set constructor as function', () => {
        class User {}
        const spec = sb.object().construct(User).build()

        expect(spec.$construct).toBe(User)
      })
    })

    describe('constructCollection()', () => {
      it('should set collection constructor as string', () => {
        const spec = sb.object().constructCollection('Collection').build()

        expect(spec.$constructCollection).toBe('Collection')
      })

      it('should set collection constructor as function', () => {
        class Collection {}
        const spec = sb.object().constructCollection(Collection).build()

        expect(spec.$constructCollection).toBe(Collection)
      })
    })
  })

  describe('inherited validation methods', () => {
    it('should support required()', () => {
      const spec = sb.object().required().build()
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support notNull()', () => {
      const spec = sb.object().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notEmpty()', () => {
      const spec = sb.object().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support isEmpty()', () => {
      const spec = sb.object().isEmpty().build()
      expect(spec.$validate?.isEmpty).toBe(true)
    })
  })

  describe('inherited filter methods', () => {
    it('should support default()', () => {
      const defaultValue = { status: 'active' }
      const spec = sb.object().default(defaultValue).build()
      expect(spec.$filter?.defaultValue).toEqual(defaultValue)
    })

    it('should support default() with null', () => {
      const spec = sb.object().nullable().default(null).build()
      expect(spec.$filter?.defaultValue).toBeNull()
    })

    it('should support private()', () => {
      const spec = sb.object().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support custom()', () => {
      const customFn = (value: any) => typeof value === 'object'
      const spec = sb.object().custom(customFn).build()
      expect(spec.$filter?.custom).toBe(customFn)
    })
  })

  describe('inherited metadata methods', () => {
    it('should support label()', () => {
      const spec = sb.object().label('User Profile').build()
      expect(spec.$label).toBe('User Profile')
    })

    it('should support nullable()', () => {
      const spec = sb.object().nullable().build()
      expect(spec.$nullable).toBe(true)
    })

    it('should support relation()', () => {
      const spec = sb.object().relation().build()
      expect(spec.$relation).toBe(true)
    })
  })

  describe('method chaining', () => {
    it('should chain object-specific methods', () => {
      const spec = sb
        .object()
        .shape({
          id: sb.string().required(),
        })
        .strict()
        .construct('User')
        .constructCollection('UserCollection')
        .build()

      expect(spec.id?.$validate?.required).toBe(true)
      expect(spec.$strict).toBe(true)
      expect(spec.$construct).toBe('User')
      expect(spec.$constructCollection).toBe('UserCollection')
    })

    it('should chain validation and filter methods', () => {
      const spec = sb.object().required().notNull().label('Settings').build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notNull).toBe(true)
      expect(spec.$label).toBe('Settings')
    })

    it('should support complex object definition', () => {
      const spec = sb
        .object()
        .shape({
          email: sb.string().required().email().trim().lowercase(),
          name: sb.string().required().trim(),
          age: sb.number().nullable(),
          tags: sb.array().of({ $type: String }),
        })
        .required({ message: 'User object is required' })
        .strict()
        .label('User')
        .build()

      expect(spec.$type).toBe(Object)
      expect(spec.$strict).toBe(true)
      expect(spec.$label).toBe('User')
      expect(spec.$validate?.required).toEqual({
        message: 'User object is required',
      })
      expect(spec.email?.$validate?.required).toBe(true)
      expect(spec.email?.$validate?.email).toBe(true)
      expect(spec.name?.$filter?.trim).toBe(true)
      expect(spec.age?.$nullable).toBe(true)
      expect(spec.tags?.$type).toBe(Array)
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.object().build()
      expect(spec.$type).toBe(Object)
    })

    it('should chain nullable and required', () => {
      const spec = sb.object().nullable().required().build()
      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
    })

    it('should allow schema reference with shape', () => {
      const spec = sb
        .object()
        .schema('user')
        .shape({
          extraField: sb.string(),
        })
        .build()

      expect(spec.$schema).toBe('user')
      expect(spec.extraField?.$type).toBe(String)
    })

    it('should handle empty shape', () => {
      const spec = sb.object().shape({}).build()

      expect(spec.$type).toBe(Object)
    })

    it('should overwrite schema when called multiple times', () => {
      const spec = sb.object().schema('user').schema('admin').build()

      expect(spec.$schema).toBe('admin')
    })
  })

  describe('common use cases', () => {
    it('should create a user object schema', () => {
      const spec = sb
        .object()
        .shape({
          id: sb.string().required(),
          email: sb.string().required().email().lowercase().trim(),
          name: sb.string().required().trim(),
          active: sb.boolean().default(true),
          createdAt: sb.date().default('now'),
        })
        .strict()
        .label('User')
        .build()

      expect(spec.$type).toBe(Object)
      expect(spec.$strict).toBe(true)
      expect(spec.$label).toBe('User')
      expect(spec.id?.$validate?.required).toBe(true)
      expect(spec.email?.$validate?.email).toBe(true)
      expect(spec.active?.$filter?.defaultValue).toBe(true)
    })

    it('should create an l10n object with match-all', () => {
      const spec = sb
        .object()
        .matchAll(sb.string())
        .label('Localization')
        .build()

      expect(spec.$type).toBe(Object)
      expect(spec['*'].$type).toBe(String)
      expect(spec.$label).toBe('Localization')
    })

    it('should create a schema reference object', () => {
      const spec = sb
        .object()
        .schema('address')
        .nullable()
        .label('Shipping Address')
        .build()

      expect(spec.$schema).toBe('address')
      expect(spec.$nullable).toBe(true)
      expect(spec.$label).toBe('Shipping Address')
    })

    it('should create a relation object', () => {
      const spec = sb
        .object()
        .schema('user')
        .relation()
        .private()
        .construct('User')
        .build()

      expect(spec.$schema).toBe('user')
      expect(spec.$relation).toBe(true)
      expect((spec.$filter as any)?.private).toBe(true)
      expect(spec.$construct).toBe('User')
    })

    it('should create nested object structures', () => {
      const spec = sb
        .object()
        .shape({
          user: sb.object().shape({
            profile: sb.object().shape({
              firstName: sb.string().required(),
              lastName: sb.string().required(),
            }),
          }),
        })
        .build()

      expect(spec.user?.$type).toBe(Object)
      expect(spec.user?.profile?.$type).toBe(Object)
      expect(spec.user?.profile?.firstName?.$validate?.required).toBe(true)
    })
  })

  describe('type safety', () => {
    it('should maintain correct $type after multiple chains', () => {
      const spec = sb
        .object()
        .shape({ name: sb.string() })
        .required()
        .label('Object')
        .nullable()
        .private()
        .build()

      expect(spec.$type).toBe(Object)
    })
  })

  describe('dynamic objects', () => {
    it('should create an object with dynamic string values', () => {
      const spec = sb
        .object()
        .matchAll(sb.string().trim())
        .label('Metadata')
        .build()

      expect(spec['*'].$type).toBe(String)
      expect(spec['*'].$filter?.trim).toBe(true)
    })

    it('should combine static and dynamic properties', () => {
      const spec = sb
        .object()
        .shape({
          id: sb.string().required(),
          type: sb.string().required(),
        })
        .matchAll(sb.mixed())
        .build()

      expect(spec.id?.$validate?.required).toBe(true)
      expect(spec.type?.$validate?.required).toBe(true)
      expect(spec['*']).toBeDefined()
    })
  })

  describe('complex compositions', () => {
    it('should create object with arrays of objects', () => {
      const spec = sb
        .object()
        .shape({
          items: sb.array().of(
            sb.object().shape({
              id: sb.string().required(),
              quantity: sb.number().default(1),
            })
          ),
        })
        .build()

      expect(spec.items?.$type).toBe(Array)
      expect(spec.items?.$spec?.$type).toBe(Object)
      expect(spec.items?.$spec?.id?.$validate?.required).toBe(true)
      expect(spec.items?.$spec?.quantity?.$filter?.defaultValue).toBe(1)
    })

    it('should create object with nested arrays and objects', () => {
      const spec = sb
        .object()
        .shape({
          name: sb.string().required(),
          categories: sb.array().of(
            sb.object().shape({
              id: sb.string().required(),
              subcategories: sb.array().of({ $type: String }),
            })
          ),
        })
        .build()

      expect(spec.categories?.$spec?.subcategories?.$type).toBe(Array)
      expect(spec.categories?.$spec?.subcategories?.$spec?.$type).toBe(String)
    })
  })
})
