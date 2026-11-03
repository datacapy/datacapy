import { Schema } from '../schema'
import { SchemaBuilder as sb } from './schema-builder'

const ISO_DATE = '2026-01-02T00:00:00.000Z'

describe('SchemaBuilder.applyDefaults', () => {
  const shape = {
    name: sb.string().required(),
    status: sb.string().default('running'),
    count: sb.number().default(0),
    closedAt: sb.date().default(null),
    createdAt: sb.date().default('now'),
    tags: sb.array().default(() => []),
  }

  it('fills undefined and null keys with their defaults', () => {
    const result = sb.applyDefaults(shape, { name: 'a', status: null })
    expect(result.status).toBe('running')
    expect(result.count).toBe(0)
    expect(result.closedAt).toBeNull()
    expect(result.tags).toEqual([])
  })

  it('turns the date keyword now into a Date', () => {
    const result = sb.applyDefaults(shape, {})
    expect(result.createdAt).toBeInstanceOf(Date)
  })

  it('keeps given values, including falsy ones', () => {
    const result = sb.applyDefaults(shape, {
      name: '',
      count: 0,
      status: 'done',
    })
    expect(result).toMatchObject({ name: '', count: 0, status: 'done' })
  })

  it('leaves a key with no default absent', () => {
    expect('name' in sb.applyDefaults(shape, {})).toBe(false)
  })

  it('calls a function default each time', () => {
    const a = sb.applyDefaults(shape, {})
    const b = sb.applyDefaults(shape, {})
    expect(a.tags).not.toBe(b.tags)
  })

  it('accepts no data', () => {
    expect(sb.applyDefaults(shape).status).toBe('running')
  })

  describe('init', () => {
    const initShape = {
      projectId: sb.string().required().init(''),
      total: sb.number().required().init(0),
      tags: sb.array().init(() => ['a']),
      kind: sb.string().init('x').default('y'),
    }

    it('fills a construct-time value without adding a spec filter', () => {
      const result = sb.applyDefaults(initShape, {})
      expect(result).toMatchObject({ projectId: '', total: 0, kind: 'y' })
      expect(initShape.projectId.build().$filter).toBeUndefined()
    })

    it('leaves validation strict: required still rejects a missing value', async () => {
      const schema = new Schema(
        sb.schema('init').strict().shape({ projectId: initShape.projectId })
      )
      const { isValid } = await schema.validate({})
      expect(isValid).toBe(false)
    })
  })

  describe('literal defaults', () => {
    it('gives each result its own copy of an array or object literal', () => {
      const literal = {
        list: sb.array().default([1]),
        map: sb.object().default({ a: { b: 1 } }),
      }
      const a = sb.applyDefaults(literal, {})
      const b = sb.applyDefaults(literal, {})
      expect(a.list).not.toBe(b.list)
      expect(a.map).not.toBe(b.map)
      expect((a.map as { a: object }).a).not.toBe((b.map as { a: object }).a)
      expect(a).toEqual({ list: [1], map: { a: { b: 1 } } })
    })
  })

  describe('field handling', () => {
    const optShape = {
      _id: sb.string().required(),
      status: sb.string().default('pending'),
      timeout: sb.number().default(10),
      at: sb.date().default('now'),
      endAt: sb.date().default(null),
      note: sb.string(),
    }

    it('undefined and null are missing; false, 0 and empty strings are kept', () => {
      const flags = {
        on: sb.boolean().default(true),
        n: sb.number().default(3),
        s: sb.string().default('x'),
      }
      expect(sb.applyDefaults(flags, { on: false, n: 0, s: '' })).toEqual({
        on: false,
        n: 0,
        s: '',
      })
      expect(sb.applyDefaults(flags, { on: null, n: undefined })).toMatchObject(
        { on: true, n: 3 }
      )
    })

    it('turns date strings and numbers into Dates and keeps null', () => {
      const result = sb.applyDefaults(optShape, {
        at: ISO_DATE as unknown as Date,
        endAt: null,
      })
      expect(result.at).toEqual(new Date('2026-01-02T00:00:00.000Z'))
      expect(result.endAt).toBeNull()
      const epoch = sb.applyDefaults(optShape, { at: 0 as unknown as Date })
      expect(epoch.at).toEqual(new Date(0))
    })

    it('construct(Class) wraps a present value in the class and leaves null alone', () => {
      class Box {
        constructor(public v: unknown) {}
      }
      const shape = {
        a: sb.object().construct(Box).default({}),
        b: sb.object().construct(Box).nullable().default(null),
        c: sb.object().construct('Named').default({}),
      }
      const result = sb.applyDefaults(shape, { b: { x: 1 } })
      expect(result.a).toBeInstanceOf(Box)
      expect((result.a as Box).v).toEqual({})
      expect((result.b as Box).v).toEqual({ x: 1 })
      expect(sb.applyDefaults(shape, {}).b).toBeNull()
      expect(result.c).toEqual({})
    })

    it('construct(thunk) is resolved on first call, so a later-defined class works', () => {
      let Late: (new (v: unknown) => unknown) | undefined
      const fill = sb.defaultsFor({
        a: sb.object().construct(() => Late as never),
      })
      class LateBox {
        constructor(public v: unknown) {}
      }
      Late = LateBox
      expect(fill({ a: { x: 1 } }).a).toBeInstanceOf(LateBox)
      expect(fill({ a: { x: 1 } }).a).toBeInstanceOf(LateBox)
    })

    it('construct(thunk) leaves null and missing alone', () => {
      class Box {
        constructor(public v: unknown) {}
      }
      const fill = sb.defaultsFor({
        a: sb
          .object()
          .construct(() => Box)
          .nullable()
          .default(null),
      })
      expect(fill({}).a).toBeNull()
      expect(fill({ a: { x: 1 } }).a).toBeInstanceOf(Box)
    })

    it('an array field wraps each item with the item spec constructor', () => {
      class Box {
        constructor(public v: unknown) {}
      }
      const fill = sb.defaultsFor({
        items: sb.array(sb.object().construct(() => Box)).default([]),
      })
      const result = fill({ items: [{ a: 1 }, { a: 2 }] })
      expect(result.items?.every((i) => i instanceof Box)).toBe(true)
      expect(result.items).toHaveLength(2)
      expect(fill({}).items).toEqual([])
      expect(fill({ items: null }).items).toEqual([])
    })
  })

  describe('defaultsFor', () => {
    it('gives the same result as applyDefaults and can be reused', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const shape = {
        a: sb.string().default('x'),
        b: sb.number().init(0),
        at: sb.date().default('now'),
      }
      const fill = sb.defaultsFor(shape)
      expect(fill({ a: '' })).toEqual(sb.applyDefaults(shape, { a: '' }))
      expect(fill({ b: 2 }).b).toBe(2)
      expect(fill().a).toBe('x')
      expect(fill(null).b).toBe(0)
      jest.useRealTimers()
    })

    it('fills a given target in place and returns it', () => {
      const shape = { a: sb.string().default('x'), b: sb.number().init(0) }
      const target: Record<string, unknown> = {}
      const out = sb.defaultsFor(shape)({ b: 2, z: 1 } as never, target)
      expect(out).toBe(target)
      expect(target).toEqual({ a: 'x', b: 2, z: 1 })
      const loose: Record<string, unknown> = {}
      sb.defaultsFor(shape)({ z: 1 } as never, loose)
      expect(loose).toEqual({ a: 'x', b: 0, z: 1 })
    })
  })
})
