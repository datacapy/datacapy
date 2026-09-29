import { BuilderString } from './builder-string'
import { sb } from './index'

/**
 * Test suite for BuilderString class
 * Tests string-specific validation and filter methods
 */
describe('BuilderString', () => {
  describe('basic creation', () => {
    it('should create a string field with correct type', () => {
      const spec = sb.string().build()
      expect(spec.$type).toBe(String)
    })

    it('should create a string field using new BuilderString()', () => {
      const spec = new BuilderString().build()
      expect(spec.$type).toBe(String)
    })
  })

  describe('validation methods', () => {
    describe('email()', () => {
      it('should set email validation', () => {
        const spec = sb.string().email().build()
        expect(spec.$validate?.email).toBe(true)
      })

      it('should set email validation with options', () => {
        const options = { message: 'Invalid email' }
        const spec = sb.string().email(options).build()
        expect(spec.$validate?.email).toEqual(options)
      })
    })

    describe('minLength()', () => {
      it('should set minimum length', () => {
        const spec = sb.string().minLength(5).build()
        expect(spec.$validate?.valueLength?.min).toBe(5)
      })

      it('should set minimum length with options', () => {
        const spec = sb.string().minLength(5, { message: 'Too short' }).build()
        expect(spec.$validate?.valueLength?.min).toBe(5)
        expect(spec.$validate?.valueLength?.message).toBe('Too short')
      })

      it('should allow chaining with maxLength', () => {
        const spec = sb.string().minLength(5).maxLength(10).build()
        expect(spec.$validate?.valueLength?.min).toBe(5)
        expect(spec.$validate?.valueLength?.max).toBe(10)
      })
    })

    describe('maxLength()', () => {
      it('should set maximum length', () => {
        const spec = sb.string().maxLength(100).build()
        expect(spec.$validate?.valueLength?.max).toBe(100)
      })

      it('should set maximum length with options', () => {
        const spec = sb.string().maxLength(100, { message: 'Too long' }).build()
        expect(spec.$validate?.valueLength?.max).toBe(100)
        expect(spec.$validate?.valueLength?.message).toBe('Too long')
      })
    })

    describe('length()', () => {
      it('should set both min and max length', () => {
        const spec = sb.string().length(5, 10).build()
        expect(spec.$validate?.valueLength?.min).toBe(5)
        expect(spec.$validate?.valueLength?.max).toBe(10)
      })

      it('should set length with options', () => {
        const spec = sb
          .string()
          .length(5, 10, { message: 'Invalid length' })
          .build()
        expect(spec.$validate?.valueLength?.min).toBe(5)
        expect(spec.$validate?.valueLength?.max).toBe(10)
        expect(spec.$validate?.valueLength?.message).toBe('Invalid length')
      })
    })

    describe('regex()', () => {
      it('should set regex validation with RegExp', () => {
        const pattern = /^[A-Z]+$/
        const spec = sb.string().regex(pattern).build()
        expect(spec.$validate?.regex).toHaveProperty('pattern', pattern)
      })

      it('should set regex validation with string pattern', () => {
        const pattern = '^[A-Z]+$'
        const spec = sb.string().regex(pattern).build()
        expect(spec.$validate?.regex).toHaveProperty('pattern', pattern)
      })

      it('should set regex validation with options', () => {
        const pattern = /^test$/
        const spec = sb
          .string()
          .regex(pattern, { message: 'Invalid format' })
          .build()
        expect(spec.$validate?.regex).toHaveProperty('pattern', pattern)
        expect(spec.$validate?.regex).toHaveProperty(
          'message',
          'Invalid format'
        )
      })

      it('should support multiple regex patterns', () => {
        const spec = sb
          .string()
          .regex(/^[A-Z]/, { message: 'Must start with uppercase' })
          .regex(/[0-9]$/, { message: 'Must end with digit' })
          .build()

        expect(Array.isArray(spec.$validate?.regex)).toBe(true)
        expect(spec.$validate?.regex).toHaveLength(2)
      })
    })

    describe('inArray()', () => {
      it('should set inArray validation', () => {
        const values = ['active', 'inactive', 'pending']
        const spec = sb.string().inArray(values).build()
        expect(spec.$validate?.inArray?.values).toEqual(values)
      })

      it('should set inArray validation with options', () => {
        const values = ['red', 'green', 'blue']
        const spec = sb
          .string()
          .inArray(values, { message: 'Invalid color' })
          .build()
        expect(spec.$validate?.inArray?.values).toEqual(values)
        expect(spec.$validate?.inArray?.message).toBe('Invalid color')
      })
    })
  })

  describe('filter methods', () => {
    describe('trim()', () => {
      it('should enable trim filter', () => {
        const spec = sb.string().trim().build()
        expect(spec.$filter?.trim).toBe(true)
      })
    })

    describe('uppercase()', () => {
      it('should enable uppercase filter', () => {
        const spec = sb.string().uppercase().build()
        expect(spec.$filter?.uppercase).toBe(true)
      })
    })

    describe('lowercase()', () => {
      it('should enable lowercase filter', () => {
        const spec = sb.string().lowercase().build()
        expect(spec.$filter?.lowercase).toBe(true)
      })
    })

    describe('stripHtml()', () => {
      it('should enable stripHtml filter', () => {
        const spec = sb.string().stripHtml().build()
        expect((spec.$filter as any)?.stripHtml).toBe(true)
      })
    })

    describe('prependHttpIfMissing()', () => {
      it('should configure a conditional prependHttp filter', () => {
        const spec = sb.string().prependHttpIfMissing().build()
        expect(
          (spec.$filter as any)?.prependHttp?.$if?.$not?.$regex
        ).toBeInstanceOf(RegExp)
      })
    })
  })

  describe('inherited base methods', () => {
    it('should support required()', () => {
      const spec = sb.string().required().build()
      expect(spec.$validate?.required).toBe(true)
    })

    it('should support notNull()', () => {
      const spec = sb.string().notNull().build()
      expect(spec.$validate?.notNull).toBe(true)
    })

    it('should support notEmpty()', () => {
      const spec = sb.string().notEmpty().build()
      expect(spec.$validate?.notEmpty).toBe(true)
    })

    it('should support default()', () => {
      const spec = sb.string().default('hello').build()
      expect(spec.$filter?.defaultValue).toBe('hello')
    })

    it('should support private()', () => {
      const spec = sb.string().private().build()
      expect((spec.$filter as any)?.private).toBe(true)
    })

    it('should support label()', () => {
      const spec = sb.string().label('Email Address').build()
      expect(spec.$label).toBe('Email Address')
    })

    it('should support nullable()', () => {
      const spec = sb.string().nullable().build()
      expect(spec.$nullable).toBe(true)
    })
  })

  describe('method chaining', () => {
    it('should chain multiple validation methods', () => {
      const spec = sb
        .string()
        .required()
        .email()
        .minLength(5)
        .maxLength(100)
        .build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.email).toBe(true)
      expect(spec.$validate?.valueLength?.min).toBe(5)
      expect(spec.$validate?.valueLength?.max).toBe(100)
    })

    it('should chain multiple filter methods', () => {
      const spec = sb.string().trim().lowercase().default('test').build()

      expect(spec.$filter?.trim).toBe(true)
      expect(spec.$filter?.lowercase).toBe(true)
      expect(spec.$filter?.defaultValue).toBe('test')
    })

    it('should chain validation and filter methods together', () => {
      const spec = sb
        .string()
        .required()
        .notEmpty()
        .trim()
        .maxLength(50)
        .lowercase()
        .build()

      expect(spec.$validate?.required).toBe(true)
      expect(spec.$validate?.notEmpty).toBe(true)
      expect(spec.$filter?.trim).toBe(true)
      expect(spec.$validate?.valueLength?.max).toBe(50)
      expect(spec.$filter?.lowercase).toBe(true)
    })

    it('should support complex email field definition', () => {
      const spec = sb
        .string()
        .required({ message: 'Email is required' })
        .email({ message: 'Invalid email format' })
        .trim()
        .lowercase()
        .maxLength(255)
        .label('Email Address')
        .build()

      expect(spec.$type).toBe(String)
      expect(spec.$validate?.required).toEqual({ message: 'Email is required' })
      expect(spec.$validate?.email).toEqual({ message: 'Invalid email format' })
      expect(spec.$filter?.trim).toBe(true)
      expect(spec.$filter?.lowercase).toBe(true)
      expect(spec.$validate?.valueLength?.max).toBe(255)
      expect(spec.$label).toBe('Email Address')
    })
  })

  describe('edge cases', () => {
    it('should handle empty builder', () => {
      const spec = sb.string().build()
      expect(spec.$type).toBe(String)
      expect(spec.$validate).toBeUndefined()
      expect(spec.$filter).toBeUndefined()
    })

    it('should handle regex with flags', () => {
      const pattern = /test/gi
      const spec = sb.string().regex(pattern).build()
      expect(spec.$validate?.regex).toHaveProperty('pattern', pattern)
    })

    it('should allow overwriting length constraints', () => {
      const spec = sb
        .string()
        .minLength(5)
        .maxLength(10)
        .length(1, 100) // This should overwrite previous settings
        .build()

      expect(spec.$validate?.valueLength?.min).toBe(1)
      expect(spec.$validate?.valueLength?.max).toBe(100)
    })

    it('should not conflict uppercase and lowercase', () => {
      // This is a valid schema (both filters can be set, though logically they conflict)
      const spec = sb.string().uppercase().lowercase().build()

      expect(spec.$filter?.uppercase).toBe(true)
      expect(spec.$filter?.lowercase).toBe(true)
    })
  })
})
