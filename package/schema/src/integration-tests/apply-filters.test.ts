import Schema from 'schema'

describe('applyFilters', () => {
  it('should apply defaultValue filter when field is undefined', async () => {
    const object = { name: undefined }

    const schema = new Schema({
      name: { $type: String, $filter: { defaultValue: 'Default Name' } },
    })

    const result = await schema.applyFilters(object)
    expect(result.name).toBe('Default Name')
  })

  it('should not apply defaultValue filter when field has a value', async () => {
    const object = { name: 'Existing Name' }

    const schema = new Schema({
      name: { $type: String, $filter: { defaultValue: 'Default Name' } },
    })

    const result = await schema.applyFilters(object)
    expect(result.name).toBe('Existing Name')
  })

  it('should apply lowercase filter to string values', async () => {
    const object = { name: 'JOHN DOE' }

    const schema = new Schema({
      name: { $type: String, $filter: { lowercase: true } },
    })

    const result = await schema.applyFilters(object)
    expect(result.name).toBe('john doe')
  })

  it('should apply uppercase filter to string values', async () => {
    const object = { name: 'john doe' }

    const schema = new Schema({
      name: { $type: String, $filter: { uppercase: true } },
    })

    const result = await schema.applyFilters(object)
    expect(result.name).toBe('JOHN DOE')
  })

  it('should apply trim filter to string values', async () => {
    const object = { name: '  john doe  ' }

    const schema = new Schema({
      name: { $type: String, $filter: { trim: true } },
    })

    const result = await schema.applyFilters(object)
    expect(result.name).toBe('john doe')
  })

  it('should apply multiple filters in the correct order', async () => {
    const object = { name: '  MIXED case  ' }

    const schema = new Schema({
      name: {
        $type: String,
        $filter: {
          trim: true,
          lowercase: true,
        },
      },
    })

    const result = await schema.applyFilters(object)
    expect(result.name).toBe('mixed case')
  })

  it('should apply defaultValue filter to nested objects', async () => {
    const object = { user: { name: undefined } }

    const schema = new Schema({
      user: {
        name: { $type: String, $filter: { defaultValue: 'Default Name' } },
      },
    })

    const result = await schema.applyFilters(object)
    expect(result.user.name).toBe('Default Name')
  })

  it('should apply custom filter function', async () => {
    const object = { age: 25 }

    const schema = new Schema({
      age: {
        $type: Number,
        $filter: {
          callback: (value) => value * 2,
        },
      },
    })

    const result = await schema.applyFilters(object)
    expect(result.age).toBe(50)
  })

  it('should handle null object gracefully', async () => {
    const schema = new Schema({
      name: { $type: String, $filter: { defaultValue: 'Default' } },
    })

    const result = await schema.applyFilters(null)
    expect(result).toBeNull()
  })

  it('should apply defaultValue that is a function', async () => {
    const generateId = () => 'generated-id'
    const object = { id: undefined }

    const schema = new Schema({
      id: { $type: String, $filter: { defaultValue: generateId } },
    })

    const result = await schema.applyFilters(object)
    expect(result.id).toBe('generated-id')
  })

  describe('conditional filter ($if/$then)', () => {
    it('should apply the filter when the condition is met', async () => {
      const object = { url: 'example.com' }

      const schema = new Schema({
        url: {
          $type: String,
          $filter: {
            prependHttp: { $if: { $not: { $regex: /^https?:\/\// } } },
          },
        },
      })

      const result = await schema.applyFilters(object)
      expect(result.url).toBe('http://example.com')
    })

    it('should skip the filter when the condition is not met', async () => {
      const object = { url: 'https://example.com' }

      const schema = new Schema({
        url: {
          $type: String,
          $filter: {
            prependHttp: { $if: { $not: { $regex: /^https?:\/\// } } },
          },
        },
      })

      const result = await schema.applyFilters(object)
      expect(result.url).toBe('https://example.com')
    })
  })

  describe('defaultValue - array', () => {
    it('should apply defaultValue filter when field is missing', async () => {
      const object: { items?: string[] } = {}

      const schema = new Schema({
        items: { $type: Array, $filter: { defaultValue: ['default item'] } },
      })

      const result = await schema.applyFilters(object)
      expect(result.items).toEqual(['default item'])
    })

    it('should keep an empty array instead of applying defaultValue', async () => {
      const object = { items: [] }

      const schema = new Schema({
        items: { $type: Array, $filter: { defaultValue: ['default item'] } },
      })

      const result = await schema.applyFilters(object)
      expect(result.items).toEqual([])
    })

    it('should not apply defaultValue filter when array is not empty', async () => {
      const object = { items: ['existing item'] }

      const schema = new Schema({
        items: { $type: Array, $filter: { defaultValue: ['default item'] } },
      })

      const result = await schema.applyFilters(object)
      expect(result.items).toEqual(['existing item'])
    })

    it('should apply defaultValue that is a function when field is missing', async () => {
      const generateDefaultItems = () => [
        'generated item 1',
        'generated item 2',
      ]
      const object: { items?: string[] } = {}

      const schema = new Schema({
        items: {
          $type: Array,
          $filter: { defaultValue: generateDefaultItems },
        },
      })

      const result = await schema.applyFilters(object)
      expect(result.items).toEqual(['generated item 1', 'generated item 2'])
    })
  })
})
