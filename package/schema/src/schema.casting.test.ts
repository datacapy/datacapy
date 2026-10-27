import Schema from 'schema'
import { sb } from 'builder'
import { SchemaTypeCaster } from 'utilities/type-caster'

const errorsFor = async (spec: any, value: any) => {
  const result = await new Schema({ f: spec }).validate({ f: value })
  return result
}

describe('schema casting', () => {
  describe('date', () => {
    it.each(['garbage', 'NaN', 'null', '0000-00-00', '', '2026-02-30'])(
      'rejects %j',
      async (input) => {
        const result = await errorsFor(sb.date(), input)
        expect(result.isValid).toBe(false)
        expect(result.errors.f[0]).toBe(
          `'${input}' of type String cannot be cast to type Date`
        )
      }
    )

    it('rejects an Invalid Date and a NaN timestamp', async () => {
      expect((await errorsFor(sb.date(), new Date(NaN))).isValid).toBe(false)
      expect((await errorsFor(sb.date(), NaN)).isValid).toBe(false)
    })

    it('accepts ISO strings, leap days and the now keyword', async () => {
      for (const input of [
        '2026-01-02T03:04:05Z',
        '2028-02-29',
        '2026-02-28',
        'now',
      ]) {
        const data = { f: input }
        const result = await new Schema({ f: sb.date() }).validate(data)
        expect(result.isValid).toBe(true)
        expect(data.f).toBeInstanceOf(Date)
      }
    })

    it('still defaults to now', async () => {
      const data: any = {}
      const result = await new Schema({
        f: sb.date().default('now'),
      }).validate(data)
      expect(result.isValid).toBe(true)
      expect(data.f).toBeInstanceOf(Date)
    })
  })

  describe('boolean', () => {
    it.each([
      ['true', true],
      [' TRUE ', true],
      ['1', true],
      ['on', true],
      ['yes', true],
      ['false', false],
      ['0', false],
      ['off', false],
      ['No', false],
      [1, true],
      [0, false],
    ])('casts %j to %j', async (input, expected) => {
      const data = { f: input as any }
      const result = await new Schema({ f: sb.boolean() }).validate(data)
      expect(result.isValid).toBe(true)
      expect(data.f).toBe(expected)
    })

    it.each(['maybe', '', '  ', 2, -1, 0.5])('rejects %j', async (input) => {
      const result = await errorsFor(sb.boolean(), input)
      expect(result.isValid).toBe(false)
      expect(result.errors.f[0]).toMatch(/cannot be cast to type Boolean$/)
    })
  })

  describe('number', () => {
    it.each([
      ['5', 5],
      [' 5 ', 5],
      ['-1.5', -1.5],
      ['.5', 0.5],
      ['1e3', 1000],
      [true, 1],
    ])('casts %j to %j', async (input, expected) => {
      const data = { f: input as any }
      const result = await new Schema({ f: sb.number() }).validate(data)
      expect(result.isValid).toBe(true)
      expect(data.f).toBe(expected)
    })

    it.each([
      '',
      ' ',
      '0x10',
      '0o7',
      '1e999',
      'Infinity',
      '-Infinity',
      'NaN',
      'abc',
    ])('rejects string %j', async (input) => {
      const result = await errorsFor(sb.number(), input)
      expect(result.isValid).toBe(false)
      expect(result.errors.f[0]).toBe(
        `'${input}' of type String cannot be cast to type Number`
      )
    })

    it.each([NaN, Infinity, -Infinity])('rejects number %j', async (input) => {
      const result = await errorsFor(sb.number(), input)
      expect(result.isValid).toBe(false)
    })
  })

  describe('type detection', () => {
    it('treats a null-prototype object as an Object', () => {
      expect(SchemaTypeCaster.getTypeName(Object.create(null))).toBe('Object')
    })

    it('reports a validation error for a null-prototype object in a String field', async () => {
      const result = await errorsFor(sb.string(), Object.create(null))
      expect(result.isValid).toBe(false)
    })
  })
})
