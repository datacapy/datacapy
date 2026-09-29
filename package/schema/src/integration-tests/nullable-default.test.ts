import Schema from 'schema'

/**
 * Test suite for $nullable and $filter: { defaultValue: null } behavior
 *
 * These tests verify that Object-type fields correctly default to null when:
 * - $nullable: true is set
 * - $filter: { defaultValue: null } is configured
 *
 * This works with:
 * - Direct schema definitions
 * - $schema references
 * - applyTransients() + validate() sequences
 * - Various merge scenarios
 *
 * All tests pass, confirming the functionality works correctly.
 */
describe('$schema reference with $nullable and defaultValue: null', () => {
  it('should default to null when using $schema reference with $nullable: true and defaultValue: null', async () => {
    // Define a reusable schema for l10nHtml (Object type)
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $spec: {
        en: { $type: String },
        es: { $type: String },
        fr: { $type: String },
      },
    })

    // Define the main schema with desc property referencing l10nHtml
    const mainSchema = new Schema(
      {
        name: { $type: String },
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = { name: 'Test' }

    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should default to null for nested object without $schema reference (control test)', async () => {
    // Control test: same scenario but without $schema reference
    const schema = new Schema({
      name: { $type: String },
      desc: {
        $type: Object,
        $nullable: true,
        $filter: { defaultValue: null },
        $spec: {
          en: { $type: String },
          es: { $type: String },
          fr: { $type: String },
        },
      },
    })

    const data: any = { name: 'Test' }

    await schema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should default to null when property is explicitly undefined', async () => {
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = { desc: undefined }

    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should preserve null value when explicitly set', async () => {
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = { desc: null }

    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should check if $filter from $schema reference is properly merged', async () => {
    // Test if defaultValue in the l10nHtml schema itself works
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $nullable: true,
      $filter: { defaultValue: null },
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        // Just reference the schema without additional config
        desc: {
          $schema: 'l10nHtml',
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = {}

    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should not lose $filter.defaultValue when $schema has other filters', async () => {
    // Test if defaultValue gets lost when the referenced schema has other filters
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $filter: {
        // Some other filter in the schema
        callback: (value) => value,
      },
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null }, // Does this override or merge with schema's filter?
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = {}

    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should handle $schema reference defined inline vs separate Schema', async () => {
    // Sometimes the issue is HOW the schema is defined
    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: new Schema({
            $name: 'l10nHtml',
            $type: Object,
            $spec: {
              en: { $type: String },
            },
          }),
        },
      }
    )

    const data: any = {}

    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should preserve settings when referencing schema without local overrides', async () => {
    // Test that referenced schema's $nullable and $filter are preserved
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $nullable: true,
      $filter: { defaultValue: null },
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = {}
    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should handle applyTransients() without creating empty objects', async () => {
    // This tests if applyTransients creates unwanted empty objects
    // applyTransients uses SchemaIterator.mapField which has its own defaultValue logic
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $nullable: true,
      $filter: { defaultValue: null },
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        name: { $type: String },
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = { name: 'Test' }

    mainSchema.applyTransients(data)

    expect(data.desc).toBeNull()
  })

  it('should handle applyTransients() then validate() sequence', async () => {
    // Real-world scenario: applyTransients followed by validate
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $nullable: true,
      $filter: { defaultValue: null },
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        name: { $type: String },
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = { name: 'Test' }

    mainSchema.applyTransients(data)
    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should handle conflicting $filter objects during merge', async () => {
    // Test when both base schema and local spec have $filter objects
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $nullable: true,
      $filter: {
        callback: (value) => value,
      },
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: {
            defaultValue: null, // Local filter should override/merge
          },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = {}
    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should override base schema settings with local settings', async () => {
    // Test when base l10nHtml schema has no $nullable or $filter
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = {}
    await mainSchema.validate(data)

    expect(data.desc).toBeNull()
  })

  it('should allow valid object value when provided', async () => {
    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $type: Object,
      $spec: {
        en: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
      }
    )

    const data: any = { desc: { en: 'Hello' } }

    const result = await mainSchema.validate(data)

    expect(result.isValid).toBe(true)
    expect(data.desc).toEqual({ en: 'Hello' })
  })

  it('should not apply constructor when value is null and field is nullable', async () => {
    // Define a constructor that would create an empty object from null
    class L10n {
      [key: string]: any
      constructor(data: any = {}) {
        Object.assign(this, data)
      }
    }

    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $construct: 'L10n',
      $type: Object,
      $spec: {
        en: { $type: String },
        es: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        name: { $type: String },
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
        constructors: {
          L10n: L10n,
        },
      }
    )

    // Simulate data from database with null desc
    const dataFromDb: any = {
      name: 'Test Group',
      desc: null,
    }

    // applyTransients should preserve null and NOT apply constructor
    const result = mainSchema.applyTransients(dataFromDb)

    expect(result.desc).toBeNull()
    // Ensure it's not an instance of L10n
    expect(result.desc instanceof L10n).toBe(false)
  })

  it('should apply constructor when value is non-null object', async () => {
    // Define a constructor that would create an empty object from null
    class L10n {
      [key: string]: any
      constructor(data: any = {}) {
        Object.assign(this, data)
      }
    }

    const l10nHtmlSchema = new Schema({
      $name: 'l10nHtml',
      $construct: 'L10n',
      $type: Object,
      $spec: {
        en: { $type: String },
        es: { $type: String },
      },
    })

    const mainSchema = new Schema(
      {
        name: { $type: String },
        desc: {
          $schema: 'l10nHtml',
          $nullable: true,
          $filter: { defaultValue: null },
        },
      },
      {
        schemas: {
          l10nHtml: l10nHtmlSchema,
        },
        constructors: {
          L10n: L10n,
        },
      }
    )

    // Data with actual object value
    const dataFromDb: any = {
      name: 'Test Group',
      desc: { en: 'Hello', es: 'Hola' },
    }

    // applyTransients SHOULD apply constructor for non-null values
    const result = mainSchema.applyTransients(dataFromDb)

    expect(result.desc).not.toBeNull()
    expect(result.desc instanceof L10n).toBe(true)
    expect(result.desc.en).toBe('Hello')
    expect(result.desc.es).toBe('Hola')
  })
})
