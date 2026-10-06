import Schema from 'schema'
import SchemaIterator from 'iterator'

describe('SchemaIterator', () => {
  describe('iterate', () => {
    it('should callback with field spec', () => {
      const spec = { name: String, $strict: true }
      const schemaIterator = new SchemaIterator(spec)

      const results: any[] = []
      schemaIterator.iterate({ name: 'Kevin' }, (opts) => {
        results.push(opts.spec)
      })
      expect(results[0]).toEqual(spec)
      expect(results[1]).toEqual(spec.name)
    })
    it('should callback with field name', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)

      const results: any[] = []
      // @ts-ignore - unused fieldSpec
      schemaIterator.iterate({ name: 'Kevin' }, (opts) => {
        results.push(opts.fieldName)
      })

      expect(results[0]).toBe('root')
      expect(results[1]).toBe('name')
    })
    it('should callback with field index of array value', () => {
      const spec = { names: [String] }
      const schemaIterator = new SchemaIterator(spec)

      const results: any[] = []
      // @ts-ignore - unused fieldSpec
      schemaIterator.iterate({ names: ['Kevin'] }, (opts) => {
        results.push(opts.fieldName)
      })

      expect(results[0]).toBe('root')
      expect(results[1]).toBe('names')
      expect(results[2]).toBe(0)
    })
    it('should callback with field container object', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)
      const value = [{ name: 'Kevin' }]

      const results: any[] = []
      // @ts-ignore - unused fieldSpec and fieldName
      schemaIterator.iterate(value, (opts) => {
        results.push(opts.container)
      })

      expect(results[1]).toBe(value)
      expect(results[2]).toBe(value[0])
    })
    it('should callback with field container array', () => {
      const spec = { names: [String] }
      const schemaIterator = new SchemaIterator(spec)
      const value = [{ names: ['Kevin'] }]

      const results: any[] = []
      // @ts-ignore - unused fieldSpec and fieldName
      schemaIterator.iterate(value, (opts) => {
        results.push(opts.container)
      })

      expect(results[1]).toBe(value)
      expect(results[2]).toBe(value[0])
      expect(results[3]).toBe(value[0].names)
    })
    it('should callback with field path', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)

      const results: any[] = []
      // @ts-ignore - unused fieldSpec and fieldName and fieldContainer
      schemaIterator.iterate({ name: 'Kevin' }, (opts) => {
        results.push(opts.path)
      })

      expect(results[0]).toBe('')
      expect(results[1]).toBe('name')
    })
    it('should callback with field path of nested array', () => {
      const spec = {}
      const schemaIterator = new SchemaIterator(spec)

      const data = [
        {
          name: 'A0',
          children: [{ name: 'A1' }, { name: 'B1' }, { name: 'C1' }],
        },
        { name: 'B0' },
        { name: 'C0' },
      ]

      const results: any[] = []
      // @ts-ignore - unused fieldSpec and fieldName and fieldContainer
      schemaIterator.iterate(data, (opts) => {
        results.push(opts.path)
      })

      expect(results[0]).toBe('')
      expect(results[1]).toBe('0')
      expect(results[2]).toBe('0.name')
      expect(results[3]).toBe('0.children')
      expect(results[4]).toBe('1')
      expect(results[5]).toBe('1.name')
      expect(results[6]).toBe('2')
      expect(results[7]).toBe('2.name')
    })
  })
  it('should callback with field spec from embedded schema reference', () => {
    const specAddress = {
      $name: 'address', // this defines hte schema name
      $strict: true,
      buildingNumber: Number,
      street: String,
      city: String,
      country: String,
    }
    const specUser = {
      $name: 'user', // this defines hte schema name
      name: String,
      address: { $schema: 'address' },
    }

    const schemaIterator = new SchemaIterator(specUser, {
      schemas: [new Schema(specAddress)],
    })

    const results: any[] = []
    schemaIterator.iterate({ name: 'Kevin' }, (opts) => {
      results.push(opts.spec)
    })

    expect(results[0].address).toEqual(specAddress)
  })
  describe('iteratePaths', () => {
    it('should callback with field spec', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)
      schemaIterator.iteratePaths({ name: 'Kevin' }, (opts) => {
        expect(opts.spec).toBe(String)
      })
    })
    it('should callback with field name', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)
      // @ts-ignore - unused fieldSpec
      schemaIterator.iteratePaths({ name: 'Kevin' }, (opts) => {
        expect(opts.fieldName).toBe('name')
      })
    })
    it('should callback with field index of array value', () => {
      const spec = { names: [String] }
      const schemaIterator = new SchemaIterator(spec)

      const results: any[] = []
      // @ts-ignore - unused fieldSpec
      schemaIterator.iteratePaths({ names: ['Kevin'] }, (opts) => {
        results.push(opts.fieldName)
      })
      expect(results[0]).toBe('names')
      expect(results[1]).toBe(0)
    })
    it('should callback with field container object', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)
      const object = { name: 'Kevin' }
      // @ts-ignore - unused fieldSpec and fieldName
      schemaIterator.iteratePaths({ name: 'Kevin' }, (opts) => {
        expect(opts.container).toEqual(object)
      })
    })
    it('should callback with field container array', () => {
      const spec = { names: [String] }
      const schemaIterator = new SchemaIterator(spec)
      const value = { names: ['Kevin'] }

      const results: any[] = []
      // @ts-ignore - unused fieldSpec and fieldName
      schemaIterator.iteratePaths({ names: ['Kevin'] }, (opts) => {
        results.push(opts.container)
      })
      expect(results[0]).toEqual(value)
      expect(results[1]).toEqual(value.names)
    })
    it('should callback with field path', () => {
      const spec = { name: String }
      const schemaIterator = new SchemaIterator(spec)
      // @ts-ignore - unused fieldSpec and fieldName and fieldContainer
      schemaIterator.iteratePaths({ name: 'Kevin' }, (opts) => {
        expect(opts.path).toBe('name')
      })
    })
  })

  describe('mapField prototype pollution', () => {
    it('ignores a __proto__ field name', () => {
      const schemaIterator = new SchemaIterator({ name: String })
      const container = {}
      const callback = jest.fn()
      schemaIterator.mapField({
        spec: { name: String },
        specParent: {},
        fieldName: '__proto__',
        container,
        path: '__proto__',
        callback,
        config: {},
        meta: {},
      })
      expect(callback).not.toHaveBeenCalled()
      expect(Object.getPrototypeOf(container)).toBe(Object.prototype)
      expect(Object.keys(container)).toEqual([])
    })
  })
})
