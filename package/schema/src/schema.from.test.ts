import { Schema } from './schema'
import { SchemaBuilder as sb } from './builder'

class SchemaNote extends Schema.from(
  sb.schema('note').shape({
    _id: sb.string().required().init('x'),
    pinned: sb.boolean().default(false),
  })
) {}

describe('Schema.from', () => {
  it('builds a schema named from the builder', () => {
    expect(new SchemaNote().name).toBe('note')
  })

  it('exposes the builders it was made from', () => {
    expect(Object.keys(new SchemaNote().builderFields())).toEqual([
      '_id',
      'pinned',
    ])
  })

  it('feeds defaultsFor from a class and from an instance', () => {
    const fromClass = sb.defaultsFor(SchemaNote)
    const fromInstance = sb.defaultsFor(new SchemaNote())
    expect(fromClass({})).toEqual(fromInstance({}))
    expect(fromClass({})).toMatchObject({ _id: 'x' })
  })

  it('still accepts a plain spec of builders', () => {
    const spec = { a: sb.string().init('y') }
    expect(sb.defaultsFor(spec)({})).toMatchObject({ a: 'y' })
  })
})
