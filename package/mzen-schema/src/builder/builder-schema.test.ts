import { BuilderSchema } from './builder-schema'
import { sb } from './index'

/**
 * Test suite for BuilderSchema class
 * Tests top-level schema definition builder
 */
describe('BuilderSchema', () => {
  describe('basic creation', () => {
    it('should create an empty schema', () => {
      const spec = sb.schema().build()
      expect(spec).toBeDefined()
      expect(spec.$type).toBeUndefined()
    })

    it('should create a schema with name in constructor', () => {
      const spec = sb.schema('user').build()
      expect(spec.$name).toBe('user')
    })

    it('should create a schema using new BuilderSchema()', () => {
      const spec = new BuilderSchema('product').build()
      expect(spec.$name).toBe('product')
    })
  })

  describe('schema-specific methods', () => {
    describe('name()', () => {
      it('should set schema name', () => {
        const spec = sb.schema().name('user').build()
        expect(spec.$name).toBe('user')
      })

      it('should overwrite name from constructor', () => {
        const spec = sb.schema('initial').name('final').build()
        expect(spec.$name).toBe('final')
      })
    })

    describe('construct()', () => {
      it('should set constructor as string', () => {
        const spec = sb.schema().construct('User').build()
        expect(spec.$construct).toBe('User')
      })

      it('should set constructor as function', () => {
        class User {}
        const spec = sb.schema().construct(User).build()
        expect(spec.$construct).toBe(User)
      })
    })

    describe('constructCollection()', () => {
      it('should set collection constructor as string', () => {
        const spec = sb.schema().constructCollection('UserCollection').build()
        expect(spec.$constructCollection).toBe('UserCollection')
      })

      it('should set collection constructor as function', () => {
        class Collection {}
        const spec = sb.schema().constructCollection(Collection).build()
        expect(spec.$constructCollection).toBe(Collection)
      })
    })

    describe('strict()', () => {
      it('should enable strict mode by default', () => {
        const spec = sb.schema().strict().build()
        expect(spec.$strict).toBe(true)
      })

      it('should enable strict mode with explicit true', () => {
        const spec = sb.schema().strict(true).build()
        expect(spec.$strict).toBe(true)
      })

      it('should disable strict mode with false', () => {
        const spec = sb.schema().strict(false).build()
        expect(spec.$strict).toBe(false)
      })
    })

    describe('shape()', () => {
      it('should define schema shape with SchemaSpecs', () => {
        const spec = sb.schema()
          .shape({
            name: { $type: String },
            age: { $type: Number },
          })
          .build()

        expect(spec.name?.$type).toBe(String)
        expect(spec.age?.$type).toBe(Number)
      })

      it('should define schema shape with builder instances', () => {
        const spec = sb.schema()
          .shape({
            email: sb.string().email().required(),
            active: sb.boolean().default(true),
          })
          .build()

        expect(spec.email?.$type).toBe(String)
        expect(spec.email?.$validate?.email).toBe(true)
        expect(spec.active?.$type).toBe(Boolean)
        expect(spec.active?.$filter?.defaultValue).toBe(true)
      })

      it('should handle nested objects in shape', () => {
        const spec = sb.schema()
          .shape({
            profile: sb.object().shape({
              firstName: sb.string().required(),
              lastName: sb.string().required(),
            }),
          })
          .build()

        expect(spec.profile?.$type).toBe(Object)
        expect(spec.profile?.firstName?.$validate?.required).toBe(true)
      })

      it('should allow multiple shape calls (merging)', () => {
        const spec = sb.schema()
          .shape({ name: sb.string() })
          .shape({ age: sb.number() })
          .build()

        expect(spec.name?.$type).toBe(String)
        expect(spec.age?.$type).toBe(Number)
      })
    })

    describe('matchAll()', () => {
      it('should set match-all spec with SchemaSpec', () => {
        const spec = sb.schema()
          .matchAll({ $type: String })
          .build()

        expect(spec['*']).toEqual({ $type: String })
      })

      it('should set match-all spec with builder instance', () => {
        const spec = sb.schema()
          .matchAll(sb.string().trim())
          .build()

        expect(spec['*'].$type).toBe(String)
        expect(spec['*'].$filter?.trim).toBe(true)
      })

      it('should combine with shape', () => {
        const spec = sb.schema()
          .shape({
            id: sb.string().required(),
          })
          .matchAll(sb.string())
          .build()

        expect(spec.id?.$validate?.required).toBe(true)
        expect(spec['*'].$type).toBe(String)
      })
    })

    describe('extend()', () => {
      it('should extend with another schema spec', () => {
        const baseSpec = {
          name: { $type: String },
          $strict: true,
        }

        const spec = sb.schema()
          .extend(baseSpec)
          .build()

        expect(spec.name?.$type).toBe(String)
        expect(spec.$strict).toBe(true)
      })

      it('should merge properties from extended spec', () => {
        const baseSpec = {
          id: { $type: String },
          createdAt: { $type: Date },
        }

        const spec = sb.schema()
          .shape({
            name: sb.string().required(),
          })
          .extend(baseSpec)
          .build()

        expect(spec.name?.$type).toBe(String)
        expect(spec.id?.$type).toBe(String)
        expect(spec.createdAt?.$type).toBe(Date)
      })

      it('should allow overriding extended properties', () => {
        const baseSpec = {
          status: { $type: String },
        }

        const spec = sb.schema()
          .extend(baseSpec)
          .shape({
            status: sb.string().required(), // Override
          })
          .build()

        expect(spec.status?.$validate?.required).toBe(true)
      })
    })
  })

  describe('method chaining', () => {
    it('should chain all schema methods', () => {
      const spec = sb.schema()
        .name('user')
        .construct('User')
        .constructCollection('UserCollection')
        .strict()
        .shape({
          id: sb.string().required(),
        })
        .build()

      expect(spec.$name).toBe('user')
      expect(spec.$construct).toBe('User')
      expect(spec.$constructCollection).toBe('UserCollection')
      expect(spec.$strict).toBe(true)
      expect(spec.id?.$validate?.required).toBe(true)
    })

    it('should support complex schema definition', () => {
      const spec = sb.schema('product')
        .construct('Product')
        .strict(true)
        .shape({
          id: sb.string().required(),
          name: sb.string().required().trim().maxLength(255),
          price: sb.number().required(),
          active: sb.boolean().default(true),
          tags: sb.array().of({ $type: String }),
          metadata: sb.object().matchAll(sb.string()),
        })
        .build()

      expect(spec.$name).toBe('product')
      expect(spec.$construct).toBe('Product')
      expect(spec.$strict).toBe(true)
      expect(spec.id?.$validate?.required).toBe(true)
      expect(spec.name?.$validate?.valueLength?.max).toBe(255)
      expect(spec.price?.$validate?.required).toBe(true)
      expect(spec.active?.$filter?.defaultValue).toBe(true)
      expect(spec.tags?.$type).toBe(Array)
      expect(spec.metadata?.['*'].$type).toBe(String)
    })
  })

  describe('edge cases', () => {
    it('should handle empty schema', () => {
      const spec = sb.schema().build()
      expect(spec).toEqual({})
    })

    it('should handle schema with only name', () => {
      const spec = sb.schema('minimal').build()
      expect(spec.$name).toBe('minimal')
      expect(Object.keys(spec).length).toBe(1)
    })

    it('should handle shape with undefined values', () => {
      const spec = sb.schema()
        .shape({
          name: sb.string(),
          deleted: undefined,
        })
        .build()

      expect(spec.name).toBeDefined()
      expect(spec.deleted).toBeUndefined()
    })
  })

  describe('common use cases', () => {
    it('should create a complete user schema', () => {
      const spec = sb.schema('user')
        .construct('User')
        .constructCollection('UserCollection')
        .strict()
        .shape({
          _id: sb.string().required().label('ID'),
          email: sb.string().required().email().lowercase().trim(),
          name: sb.string().required().trim(),
          active: sb.boolean().default(true),
          role: sb.string().inArray(['admin', 'user', 'guest']).default('user'),
          createdAt: sb.date().default('now'),
          updatedAt: sb.date().default('now'),
        })
        .build()

      expect(spec.$name).toBe('user')
      expect(spec.$construct).toBe('User')
      expect(spec.$strict).toBe(true)
      expect(spec.email?.$validate?.email).toBe(true)
      expect(spec.role?.$validate?.inArray?.values).toContain('admin')
      expect(spec.active?.$filter?.defaultValue).toBe(true)
    })

    it('should create a localization schema with match-all', () => {
      const spec = sb.schema('l10n')
        .matchAll(sb.string())
        .build()

      expect(spec.$name).toBe('l10n')
      expect(spec['*'].$type).toBe(String)
    })

    it('should create a schema extending a base schema', () => {
      const baseTimestamps = {
        createdAt: { $type: Date, $filter: { defaultValue: 'now' } },
        updatedAt: { $type: Date, $filter: { defaultValue: 'now' } },
      }

      const spec = sb.schema('article')
        .extend(baseTimestamps)
        .shape({
          title: sb.string().required(),
          content: sb.string().required(),
        })
        .build()

      expect(spec.$name).toBe('article')
      expect(spec.title?.$validate?.required).toBe(true)
      expect(spec.createdAt?.$type).toBe(Date)
      expect(spec.updatedAt?.$filter?.defaultValue).toBe('now')
    })

    it('should create a flexible config schema', () => {
      const spec = sb.schema('config')
        .strict(false)
        .matchAll(sb.mixed())
        .build()

      expect(spec.$name).toBe('config')
      expect(spec.$strict).toBe(false)
      expect(spec['*']).toBeDefined()
    })
  })

  describe('nested schemas', () => {
    it('should handle nested schema references', () => {
      const spec = sb.schema('order')
        .shape({
          user: sb.object().schema('user'),
          items: sb.array().ofSchema('orderItem'),
          shippingAddress: sb.object().schema('address').nullable(),
        })
        .build()

      expect(spec.user?.$schema).toBe('user')
      expect(spec.items?.$spec?.$schema).toBe('orderItem')
      expect(spec.shippingAddress?.$schema).toBe('address')
      expect(spec.shippingAddress?.$nullable).toBe(true)
    })

    it('should handle deeply nested object structures', () => {
      const spec = sb.schema('company')
        .shape({
          info: sb.object().shape({
            name: sb.string().required(),
            address: sb.object().shape({
              street: sb.string(),
              city: sb.string().required(),
              country: sb.string().required(),
            }),
          }),
        })
        .build()

      expect(spec.info?.name?.$validate?.required).toBe(true)
      expect(spec.info?.address?.city?.$validate?.required).toBe(true)
    })
  })

  describe('buildValue recursion', () => {
    it('should recursively build nested builder instances', () => {
      const spec = sb.schema()
        .shape({
          simple: sb.string(),
          nested: sb.object().shape({
            deep: sb.number(),
          }),
          array: sb.array().of(sb.boolean()),
        })
        .build()

      expect(spec.simple?.$type).toBe(String)
      expect(spec.nested?.deep?.$type).toBe(Number)
      expect(spec.array?.$spec?.$type).toBe(Boolean)
    })

    it('should handle arrays in schema spec', () => {
      const spec = sb.schema()
        .shape({
          rules: [
            sb.string().required(),
            sb.number().default(0),
          ],
        })
        .build()

      // buildValue should process array elements
      expect(Array.isArray(spec.rules)).toBe(true)
      expect(spec.rules?.[0].$type).toBe(String)
      expect(spec.rules?.[1].$type).toBe(Number)
    })
  })

  describe('complex compositions', () => {
    it('should create a schema with all features combined', () => {
      const spec = sb.schema('surveyResponse')
        .name('surveyResponse')
        .construct('SurveyResponse')
        .constructCollection('SurveyResponseCollection')
        .strict(true)
        .shape({
          _id: sb.string().required(),
          surveyId: sb.string().required(),
          userId: sb.string().required(),
          answers: sb.array().of(
            sb.object().shape({
              questionId: sb.string().required(),
              value: sb.or([
                sb.string(),
                sb.number(),
                sb.boolean(),
                sb.array().of({ $type: String }),
              ]),
            })
          ),
          submittedAt: sb.date().default('now'),
        })
        .build()

      expect(spec.$name).toBe('surveyResponse')
      expect(spec.$construct).toBe('SurveyResponse')
      expect(spec.$strict).toBe(true)
      expect(spec.answers?.$spec?.value?.$or).toHaveLength(4)
    })

    it('should create schema with relations', () => {
      const spec = sb.schema('blogPost')
        .shape({
          author: sb.object().schema('user').relation(),
          comments: sb.array().ofSchema('comment').relation(),
          tags: sb.array().of({ $type: String }),
        })
        .build()

      expect(spec.author?.$relation).toBe(true)
      expect(spec.comments?.$relation).toBe(true)
      expect(spec.tags?.$relation).toBeUndefined()
    })
  })

  describe('type safety', () => {
    it('should not have $type property', () => {
      const spec = sb.schema('test')
        .shape({ name: sb.string() })
        .build()

      expect(spec.$type).toBeUndefined()
    })

    it('should preserve all schema metadata', () => {
      const spec = sb.schema('test')
        .name('test')
        .construct('Test')
        .constructCollection('TestCollection')
        .strict(true)
        .build()

      expect(spec.$name).toBe('test')
      expect(spec.$construct).toBe('Test')
      expect(spec.$constructCollection).toBe('TestCollection')
      expect(spec.$strict).toBe(true)
    })
  })
})
