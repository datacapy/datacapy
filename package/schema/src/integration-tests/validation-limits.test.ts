import Schema from 'schema'
import { SchemaValidationLimits } from '../limits'

const OVER_DEFAULT = SchemaValidationLimits.DEFAULT_MAX_COLLECTION_SIZE + 1

const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const keyed = (n: number, value: unknown = 'x') =>
  Object.fromEntries(range(n).map((i) => ['k' + i, value]))

const counter = () => {
  const state = { calls: 0, inFlight: 0, maxInFlight: 0 }
  const validator = async () => {
    state.calls++
    state.inFlight++
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
    await Promise.resolve()
    state.inFlight--
    return true
  }
  return { state, $validate: { callback: { validator } } }
}

describe('validation limits', () => {
  describe('arrays', () => {
    it('rejects an array over maxCollectionSize without validating its elements', async () => {
      const element = counter()
      const schema = new Schema(
        { tags: { $type: Array, $spec: { $type: String, ...element } } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ tags: range(11).map(String) })

      expect(result.isValid).toBe(false)
      expect(result.errors.tags).toHaveLength(1)
      expect(element.state.calls).toBe(0)
    })

    it('accepts an array exactly at maxCollectionSize and validates every element', async () => {
      const element = counter()
      const schema = new Schema(
        { tags: { $type: Array, $spec: { $type: String, ...element } } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ tags: range(10).map(String) })

      expect(result.isValid).toBe(true)
      expect(element.state.calls).toBe(10)
    })

    it('rejects an oversized array that also carries a valueLength constraint', async () => {
      const schema = new Schema(
        {
          tags: {
            $type: Array,
            $spec: { $type: String },
            $validate: { valueLength: { max: 5 } },
          },
        },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ tags: range(11).map(String) })

      expect(result.isValid).toBe(false)
      expect(result.errors.tags.length).toBeGreaterThanOrEqual(1)
    })

    it('rejects an oversized array root passed to validate', async () => {
      const schema = new Schema({ name: String }, { maxCollectionSize: 10 })

      const result = await schema.validate(range(11).map(() => ({ name: 'a' })))

      expect(result.isValid).toBe(false)
    })
  })

  describe('objects', () => {
    it("rejects a '*' object over maxCollectionSize without validating values", async () => {
      const value = counter()
      const schema = new Schema(
        { meta: { '$type': Object, '*': { $type: String, ...value } } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ meta: keyed(11) })

      expect(result.isValid).toBe(false)
      expect(result.errors.meta).toHaveLength(1)
      expect(value.state.calls).toBe(0)
    })

    it('accepts a "*" object exactly at maxCollectionSize', async () => {
      const value = counter()
      const schema = new Schema(
        { meta: { '$type': Object, '*': { $type: String, ...value } } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ meta: keyed(10) })

      expect(result.isValid).toBe(true)
      expect(value.state.calls).toBeGreaterThanOrEqual(10)
    })

    it('rejects undeclared keys over maxCollectionSize in a non-strict object', async () => {
      const schema = new Schema(
        { meta: { $type: Object, a: String } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ meta: { a: 'a', ...keyed(11) } })

      expect(result.isValid).toBe(false)
      expect(result.errors.meta).toHaveLength(1)
    })

    it('still tolerates undeclared keys under the limit in a non-strict object', async () => {
      const schema = new Schema(
        { meta: { $type: Object, a: String } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate({ meta: { a: 'a', ...keyed(5) } })

      expect(result.isValid).toBe(true)
    })

    it('caps "Field not specified" errors in strict mode and adds one summary', async () => {
      const schema = new Schema(
        { meta: { $type: Object, $strict: true, a: String } },
        { maxCollectionSize: 1000, maxFieldErrors: 5 }
      )

      const result = await schema.validate({ meta: { a: 'a', ...keyed(50) } })

      const keys = Object.keys(result.errors)
      const notSpecified = keys.filter((k) =>
        (result.errors[k] as string[]).includes('Field not specified')
      )
      expect(notSpecified).toHaveLength(5)
      expect(keys.length).toBeLessThanOrEqual(7)
      expect(JSON.stringify(result.errors)).toContain('45 more')
    })
  })

  describe('node budget', () => {
    it('reports a single root error when total nodes exceed maxNodes', async () => {
      const element = counter()
      const schema = new Schema(
        {
          rows: {
            $type: Array,
            $spec: { $type: Array, $spec: { $type: String, ...element } },
          },
        },
        { maxCollectionSize: 100, maxNodes: 500 }
      )

      const result = await schema.validate({
        rows: range(50).map(() => range(50).map(String)),
      })

      expect(result.isValid).toBe(false)
      expect(result.errors['$root']).toHaveLength(1)
      expect(element.state.calls).toBeLessThan(500)
    })

    it('accepts a payload within maxNodes', async () => {
      const schema = new Schema(
        { rows: { $type: Array, $spec: { $type: Array, $spec: String } } },
        { maxCollectionSize: 100, maxNodes: 500 }
      )

      const result = await schema.validate({
        rows: range(5).map(() => range(5).map(String)),
      })

      expect(result.isValid).toBe(true)
    })
  })

  describe('validatePaths and validateQuery', () => {
    it('validatePaths rejects an oversized array without walking it', async () => {
      const element = counter()
      const schema = new Schema(
        { tags: { $type: Array, $spec: { $type: String, ...element } } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validatePaths({
        tags: range(11).map(String),
      })

      expect(result.isValid).toBe(false)
      expect(element.state.calls).toBe(0)
    })

    it('validateQuery rejects an oversized $in operand without walking it', async () => {
      const element = counter()
      const schema = new Schema(
        { code: { $type: String, ...element } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validateQuery({
        code: { $in: range(11).map(String) },
      })

      expect(result.isValid).toBe(false)
      expect(element.state.calls).toBe(0)
    })

    it('validateQuery accepts an $in operand at the limit', async () => {
      const schema = new Schema({ code: String }, { maxCollectionSize: 10 })

      const result = await schema.validateQuery({
        code: { $in: range(10).map(String) },
      })

      expect(result.isValid).toBe(true)
    })
  })

  describe('defaults and overrides', () => {
    it('validates a 1k array under the default limit', async () => {
      const schema = new Schema({
        tags: { $type: Array, $spec: String },
      })

      const result = await schema.validate({ tags: range(1000).map(String) })

      expect(result.isValid).toBe(true)
    })

    it('rejects an array just over the default limit without walking it', async () => {
      const element = counter()
      const schema = new Schema({
        tags: { $type: Array, $spec: { $type: String, ...element } },
      })
      const tags = new Array(OVER_DEFAULT).fill('x')

      const result = await schema.validate({ tags })

      expect(result.isValid).toBe(false)
      expect(element.state.calls).toBe(0)
    })

    it('rejects an object just over the default limit without walking it', async () => {
      const value = counter()
      const schema = new Schema({
        meta: { '$type': Object, '*': { $type: String, ...value } },
      })

      const result = await schema.validate({ meta: keyed(OVER_DEFAULT) })

      expect(result.isValid).toBe(false)
      expect(value.state.calls).toBe(0)
    })

    it('lets a per-call config override the constructor config', async () => {
      const schema = new Schema(
        { tags: { $type: Array, $spec: String } },
        { maxCollectionSize: 10 }
      )

      const result = await schema.validate(
        { tags: range(11).map(String) },
        { maxCollectionSize: 20 }
      )

      expect(result.isValid).toBe(true)
    })

    it('disables the limits with Infinity', async () => {
      const schema = new Schema(
        { tags: { $type: Array, $spec: String } },
        {
          maxCollectionSize: Infinity,
          maxNodes: Infinity,
          maxFieldErrors: Infinity,
        }
      )

      const result = await schema.validate({
        tags: range(OVER_DEFAULT).map(String),
      })

      expect(result.isValid).toBe(true)
    })
  })

  describe('batched execution', () => {
    it('never has more validator calls in flight than the batch size', async () => {
      const element = counter()
      const schema = new Schema(
        { tags: { $type: Array, $spec: { $type: String, ...element } } },
        { maxCollectionSize: 2500 }
      )

      const result = await schema.validate({ tags: range(2500).map(String) })

      expect(result.isValid).toBe(true)
      expect(element.state.calls).toBe(2500)
      expect(element.state.maxInFlight).toBeLessThanOrEqual(1000)
    })

    it('keeps the error wrapping for a validator that throws', async () => {
      const schema = new Schema({
        name: {
          $type: String,
          $validate: {
            callback: {
              validator: () => {
                throw new Error('boom')
              },
            },
          },
        },
      })

      await expect(schema.validate({ name: 'a' })).rejects.toThrow(
        'Validate field failed at "name"'
      )
    })
  })

  describe('non-validation walkers stay unlimited', () => {
    it('filterPrivate still strips private fields from a collection over the limit', () => {
      const schema = new Schema(
        {
          rows: {
            $type: Array,
            $spec: {
              id: String,
              secret: { $type: String, $filter: { private: true } },
            },
          },
        },
        { maxCollectionSize: 10 }
      )
      const rows = range(50).map((i) => ({ id: String(i), secret: 's' }))

      const result = schema.filterPrivate({ rows })

      expect(result.rows).toHaveLength(50)
      expect(result.rows.every((r) => r.secret === undefined)).toBe(true)
    })
  })
})
