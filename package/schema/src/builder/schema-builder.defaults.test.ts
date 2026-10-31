import { SchemaBuilder as sb } from './schema-builder'

describe('SchemaBuilder.applyDefaults', () => {
  const shape = {
    name: sb.string().required(),
    status: sb.string().default('running'),
    count: sb.number().default(0),
    closedAt: sb.date().default(null),
    createdAt: sb.date().default('now'),
    tags: sb.array().default(() => []),
  }

  it('fills missing and null keys with their defaults', () => {
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
})
