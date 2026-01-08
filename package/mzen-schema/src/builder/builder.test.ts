import { sb } from './index'

/**
 * Test suite for builder nullable() and relation() methods
 *
 * These tests verify that:
 * - nullable() method is available on all field types
 * - nullable() correctly sets $nullable: true in SchemaSpec
 * - relation() method is available on all field types
 * - relation() correctly sets $relation: true/false in SchemaSpec
 * - Methods can be chained with other builder methods
 */
describe('Builder nullable() method', () => {
  it('should set $nullable: true on string field', () => {
    const spec = sb.string().nullable().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(String)
  })

  it('should set $nullable: true on number field', () => {
    const spec = sb.number().nullable().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(Number)
  })

  it('should set $nullable: true on boolean field', () => {
    const spec = sb.boolean().nullable().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(Boolean)
  })

  it('should set $nullable: true on date field', () => {
    const spec = sb.date().nullable().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(Date)
  })

  it('should set $nullable: true on array field', () => {
    const spec = sb.array().nullable().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(Array)
  })

  it('should set $nullable: true on object field', () => {
    const spec = sb.object().nullable().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(Object)
  })

  it('should chain with other validation methods', () => {
    const spec = sb.string().nullable().required().maxLength(100).build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$validate?.required).toBe(true)
    expect(spec.$validate?.valueLength?.max).toBe(100)
  })

  it('should chain with filter methods', () => {
    const spec = sb
      .string()
      .nullable()
      .default('test')
      .trim()
      .lowercase()
      .build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$filter?.defaultValue).toBe('test')
    expect(spec.$filter?.trim).toBe(true)
    expect(spec.$filter?.lowercase).toBe(true)
  })

  it('should work with complex array specs', () => {
    const spec = sb.array().nullable().of({ $type: String }).build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$type).toBe(Array)
    expect(spec.$spec?.$type).toBe(String)
  })

  it('should work with schema references in arrays', () => {
    const spec = sb.array().nullable().ofSchema('address').build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$spec?.$schema).toBe('address')
  })
})

describe('Builder relation() method', () => {
  it('should set $relation: true by default', () => {
    const spec = sb.object().relation().build()
    expect(spec.$relation).toBe(true)
    expect(spec.$type).toBe(Object)
  })

  it('should set $relation: false when passed false', () => {
    const spec = sb.object().relation(false).build()
    expect(spec.$relation).toBe(false)
  })

  it('should set $relation: true when passed true explicitly', () => {
    const spec = sb.array().relation(true).build()
    expect(spec.$relation).toBe(true)
  })

  it('should work on array fields', () => {
    const spec = sb.array().relation().ofSchema('userClient').build()
    expect(spec.$relation).toBe(true)
    expect(spec.$spec?.$schema).toBe('userClient')
  })

  it('should work on object fields', () => {
    const spec = sb.object().relation().schema('user').build()
    expect(spec.$relation).toBe(true)
    expect(spec.$schema).toBe('user')
  })

  it('should chain with other methods', () => {
    const spec = sb.object().relation().private().build()
    expect(spec.$relation).toBe(true)
    expect(spec.$filter?.private).toBe(true)
  })

  it('should work with string fields (edge case)', () => {
    const spec = sb.string().relation().build()
    expect(spec.$relation).toBe(true)
    expect(spec.$type).toBe(String)
  })
})

describe('Builder combined nullable() and relation()', () => {
  it('should support both nullable and relation on same field', () => {
    const spec = sb.array().nullable().relation().build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$relation).toBe(true)
  })

  it('should chain with private filter', () => {
    const spec = sb
      .array()
      .nullable()
      .relation()
      .private()
      .construct('Collection')
      .build()
    expect(spec.$nullable).toBe(true)
    expect(spec.$relation).toBe(true)
    expect(spec.$filter?.private).toBe(true)
    expect(spec.$construct).toBe('Collection')
  })

  it('should work with complex nested structure', () => {
    const spec = sb
      .array()
      .nullable()
      .relation()
      .private()
      .construct('Collection')
      .of({
        $type: Object,
        $spec: {
          id: sb.string().required().build(),
          name: sb.string().build(),
        },
      })
      .build()

    expect(spec.$nullable).toBe(true)
    expect(spec.$relation).toBe(true)
    expect(spec.$filter?.private).toBe(true)
    expect(spec.$construct).toBe('Collection')
    expect(spec.$spec?.$type).toBe(Object)
  })

  it('should chain with schema reference and default value', () => {
    const spec = sb.object().nullable().default(null).schema('l10nHtml').build()

    expect(spec.$nullable).toBe(true)
    expect(spec.$filter?.defaultValue).toBeNull()
    expect(spec.$schema).toBe('l10nHtml')
  })
})

describe('Builder method order independence', () => {
  it('should produce same result regardless of nullable position', () => {
    const spec1 = sb.string().nullable().required().maxLength(100).build()
    const spec2 = sb.string().required().nullable().maxLength(100).build()
    const spec3 = sb.string().required().maxLength(100).nullable().build()

    expect(spec1.$nullable).toBe(true)
    expect(spec2.$nullable).toBe(true)
    expect(spec3.$nullable).toBe(true)

    expect(spec1.$validate?.required).toBe(true)
    expect(spec2.$validate?.required).toBe(true)
    expect(spec3.$validate?.required).toBe(true)

    expect(spec1.$validate?.valueLength?.max).toBe(100)
    expect(spec2.$validate?.valueLength?.max).toBe(100)
    expect(spec3.$validate?.valueLength?.max).toBe(100)
  })

  it('should produce same result regardless of relation position', () => {
    const spec1 = sb.array().relation().private().ofSchema('test').build()
    const spec2 = sb.array().private().relation().ofSchema('test').build()
    const spec3 = sb.array().ofSchema('test').relation().private().build()

    expect(spec1.$relation).toBe(true)
    expect(spec2.$relation).toBe(true)
    expect(spec3.$relation).toBe(true)

    expect(spec1.$filter?.private).toBe(true)
    expect(spec2.$filter?.private).toBe(true)
    expect(spec3.$filter?.private).toBe(true)

    expect(spec1.$spec?.$schema).toBe('test')
    expect(spec2.$spec?.$schema).toBe('test')
    expect(spec3.$spec?.$schema).toBe('test')
  })
})
