import { BuilderOr } from './builder-or'
import { sb } from './index'

/**
 * Test suite for BuilderOr class
 * Tests $or operator for alternative schema specs
 */
describe('BuilderOr', () => {
  describe('basic creation', () => {
    it('should create an $or spec with SchemaSpec array', () => {
      const specs = [
        { $type: String },
        { $type: Number },
      ]
      const spec = sb.or(specs).build()

      expect(spec.$or).toBeDefined()
      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].$type).toBe(String)
      expect(spec.$or?.[1].$type).toBe(Number)
    })

    it('should create an $or spec using new BuilderOr()', () => {
      const specs = [{ $type: String }]
      const spec = new BuilderOr(specs).build()

      expect(spec.$or).toBeDefined()
      expect(spec.$or).toHaveLength(1)
    })

    it('should not set $type for $or specs', () => {
      const specs = [
        { $type: String },
        { $type: Number },
      ]
      const spec = sb.or(specs).build()

      expect(spec.$type).toBeUndefined()
      expect(spec.$or).toBeDefined()
    })
  })

  describe('builder instances as alternatives', () => {
    it('should accept builder instances', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ]).build()

      expect(spec.$or).toBeDefined()
      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].$type).toBe(String)
      expect(spec.$or?.[1].$type).toBe(Number)
    })

    it('should build nested builders', () => {
      const spec = sb.or([
        sb.string().required().trim(),
        sb.number().default(0),
      ]).build()

      expect(spec.$or?.[0].$type).toBe(String)
      expect(spec.$or?.[0].$validate?.required).toBe(true)
      expect(spec.$or?.[0].$filter?.trim).toBe(true)
      expect(spec.$or?.[1].$type).toBe(Number)
      expect(spec.$or?.[1].$filter?.defaultValue).toBe(0)
    })

    it('should handle mixed SchemaSpecs and builders', () => {
      const spec = sb.or([
        { $type: String },
        sb.number().required(),
        { $type: Boolean },
      ]).build()

      expect(spec.$or).toHaveLength(3)
      expect(spec.$or?.[0].$type).toBe(String)
      expect(spec.$or?.[1].$type).toBe(Number)
      expect(spec.$or?.[1].$validate?.required).toBe(true)
      expect(spec.$or?.[2].$type).toBe(Boolean)
    })
  })

  describe('complex alternatives', () => {
    it('should handle object alternatives', () => {
      const spec = sb.or([
        sb.object().shape({
          type: sb.string().default('user'),
          userId: sb.string().required(),
        }),
        sb.object().shape({
          type: sb.string().default('admin'),
          adminId: sb.string().required(),
        }),
      ]).build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].$type).toBe(Object)
      expect(spec.$or?.[0].type?.$filter?.defaultValue).toBe('user')
      expect(spec.$or?.[1].type?.$filter?.defaultValue).toBe('admin')
    })

    it('should handle array alternatives', () => {
      const spec = sb.or([
        sb.array().of({ $type: String }),
        sb.array().of({ $type: Number }),
      ]).build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].$type).toBe(Array)
      expect(spec.$or?.[0].$spec?.$type).toBe(String)
      expect(spec.$or?.[1].$type).toBe(Array)
      expect(spec.$or?.[1].$spec?.$type).toBe(Number)
    })

    it('should handle schema references as alternatives', () => {
      const spec = sb.or([
        { $schema: 'user' },
        { $schema: 'admin' },
      ]).build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].$schema).toBe('user')
      expect(spec.$or?.[1].$schema).toBe('admin')
    })

    it('should handle nested $or specs', () => {
      const spec = sb.or([
        sb.string(),
        sb.or([
          sb.number(),
          sb.boolean(),
        ]),
      ]).build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].$type).toBe(String)
      expect(spec.$or?.[1].$or).toBeDefined()
      expect(spec.$or?.[1].$or).toHaveLength(2)
    })
  })

  describe('inherited base methods', () => {
    it('should support nullable()', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ]).nullable().build()

      expect(spec.$nullable).toBe(true)
      expect(spec.$or).toBeDefined()
    })

    it('should support label()', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ]).label('String or Number').build()

      expect(spec.$label).toBe('String or Number')
      expect(spec.$or).toBeDefined()
    })

    it('should support required()', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ]).required().build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$or).toBeDefined()
    })

    it('should support private()', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ]).private().build()

      expect((spec.$filter as any)?.private).toBe(true)
      expect(spec.$or).toBeDefined()
    })

    it('should support default()', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ]).default('test').build()

      expect(spec.$filter?.defaultValue).toBe('test')
      expect(spec.$or).toBeDefined()
    })

    it('should support relation()', () => {
      const spec = sb.or([
        { $schema: 'user' },
        { $schema: 'admin' },
      ]).relation().build()

      expect(spec.$relation).toBe(true)
      expect(spec.$or).toBeDefined()
    })
  })

  describe('method chaining', () => {
    it('should chain multiple base methods', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ])
        .nullable()
        .required()
        .label('Flexible Field')
        .build()

      expect(spec.$nullable).toBe(true)
      expect(spec.$validate?.required).toBe(true)
      expect(spec.$label).toBe('Flexible Field')
      expect(spec.$or).toBeDefined()
    })

    it('should support complex chaining with validation and filters', () => {
      const spec = sb.or([
        sb.string().trim(),
        sb.number().default(0),
      ])
        .required({ message: 'Field is required' })
        .label('String or Number')
        .nullable()
        .build()

      expect(spec.$validate?.required).toEqual({ message: 'Field is required' })
      expect(spec.$label).toBe('String or Number')
      expect(spec.$nullable).toBe(true)
      expect(spec.$or?.[0].$filter?.trim).toBe(true)
      expect(spec.$or?.[1].$filter?.defaultValue).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty alternatives array', () => {
      const spec = sb.or([]).build()
      expect(spec.$or).toEqual([])
    })

    it('should handle single alternative', () => {
      const spec = sb.or([
        sb.string(),
      ]).build()

      expect(spec.$or).toHaveLength(1)
      expect(spec.$or?.[0].$type).toBe(String)
    })

    it('should handle many alternatives', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
        sb.boolean(),
        sb.date(),
        sb.array(),
        sb.object(),
      ]).build()

      expect(spec.$or).toHaveLength(6)
    })

    it('should preserve all builder configurations', () => {
      const spec = sb.or([
        sb.string().required().trim().maxLength(100),
        sb.number().required().default(0),
        sb.boolean().default(false),
      ]).build()

      expect(spec.$or?.[0].$validate?.required).toBe(true)
      expect(spec.$or?.[0].$filter?.trim).toBe(true)
      expect(spec.$or?.[0].$validate?.valueLength?.max).toBe(100)
      expect(spec.$or?.[1].$validate?.required).toBe(true)
      expect(spec.$or?.[1].$filter?.defaultValue).toBe(0)
      expect(spec.$or?.[2].$filter?.defaultValue).toBe(false)
    })
  })

  describe('common use cases', () => {
    it('should create a string-or-number field', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ])
        .label('ID')
        .required()
        .build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$label).toBe('ID')
      expect(spec.$validate?.required).toBe(true)
    })

    it('should create a union type for polymorphic data', () => {
      const spec = sb.or([
        sb.object().shape({
          type: sb.string().default('text'),
          content: sb.string().required(),
        }),
        sb.object().shape({
          type: sb.string().default('image'),
          url: sb.string().required(),
        }),
      ])
        .label('Media Content')
        .build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$label).toBe('Media Content')
    })

    it('should create nullable alternatives', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ])
        .nullable()
        .default(null)
        .build()

      expect(spec.$nullable).toBe(true)
      expect(spec.$filter?.defaultValue).toBeNull()
      expect(spec.$or).toHaveLength(2)
    })

    it('should create schema reference alternatives', () => {
      const spec = sb.or([
        { $schema: 'user' },
        { $schema: 'organization' },
      ])
        .label('Owner')
        .relation()
        .build()

      expect(spec.$or?.[0].$schema).toBe('user')
      expect(spec.$or?.[1].$schema).toBe('organization')
      expect(spec.$label).toBe('Owner')
      expect(spec.$relation).toBe(true)
    })

    it('should create primitive alternatives with validation', () => {
      const spec = sb.or([
        sb.string().email(),
        sb.string().regex(/^\+?[1-9]\d{1,14}$/), // Phone number
      ])
        .required({ message: 'Email or phone is required' })
        .label('Contact')
        .build()

      expect(spec.$or?.[0].$validate?.email).toBe(true)
      expect(spec.$or?.[1].$validate?.regex).toBeDefined()
      expect(spec.$validate?.required).toEqual({ message: 'Email or phone is required' })
    })
  })

  describe('deeply nested alternatives', () => {
    it('should handle complex nested object alternatives', () => {
      const spec = sb.or([
        sb.object().shape({
          user: sb.object().shape({
            id: sb.string().required(),
            profile: sb.object().schema('userProfile'),
          }),
        }),
        sb.object().shape({
          admin: sb.object().shape({
            id: sb.string().required(),
            permissions: sb.array().of({ $type: String }),
          }),
        }),
      ]).build()

      expect(spec.$or).toHaveLength(2)
      expect(spec.$or?.[0].user?.id?.$validate?.required).toBe(true)
      expect(spec.$or?.[1].admin?.permissions?.$type).toBe(Array)
    })

    it('should handle mixed builder and spec alternatives with arrays', () => {
      const spec = sb.or([
        sb.array().of(sb.string()),
        sb.array().of(sb.number()),
        { $type: String },
      ]).build()

      expect(spec.$or).toHaveLength(3)
      expect(spec.$or?.[0].$spec?.$type).toBe(String)
      expect(spec.$or?.[1].$spec?.$type).toBe(Number)
      expect(spec.$or?.[2].$type).toBe(String)
    })
  })

  describe('type safety', () => {
    it('should maintain $or property after chaining', () => {
      const spec = sb.or([
        sb.string(),
        sb.number(),
      ])
        .required()
        .nullable()
        .label('Field')
        .private()
        .build()

      expect(spec.$or).toBeDefined()
      expect(spec.$or).toHaveLength(2)
      expect(spec.$type).toBeUndefined()
    })
  })
})
