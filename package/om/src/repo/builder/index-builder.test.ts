import { TYPE_HINT_BIGINT_UNSIGNED, TYPE_HINT_TIMESTAMP } from '../type-hints'
import { repib } from './index-builder'

describe('repib', () => {
  it('builds a descending timestamp index', () => {
    expect(repib.desc('createdAt').timestamp().build()).toEqual({
      spec: { createdAt: -1 },
      options: { typeHint: TYPE_HINT_TIMESTAMP },
    })
  })

  it('builds a unique index', () => {
    expect(repib.asc('email').unique().build()).toEqual({
      spec: { email: 1 },
      options: { unique: true },
    })
  })

  it('builds a composite index with a per-field type hint', () => {
    expect(
      repib.asc('surveyId').asc('publishedAt').timestamp('publishedAt').build()
    ).toEqual({
      spec: { surveyId: 1, publishedAt: 1 },
      options: { typeHint: { publishedAt: TYPE_HINT_TIMESTAMP } },
    })
  })

  it('accumulates per-field type hints', () => {
    expect(
      repib
        .asc('a')
        .asc('b')
        .timestamp('a')
        .typeHint(TYPE_HINT_BIGINT_UNSIGNED, 'b')
        .build().options
    ).toEqual({
      typeHint: { a: TYPE_HINT_TIMESTAMP, b: TYPE_HINT_BIGINT_UNSIGNED },
    })
  })

  it('applies a type hint to all fields when none are named', () => {
    expect(
      repib.asc('ipFrom').typeHint(TYPE_HINT_BIGINT_UNSIGNED).build()
    ).toEqual({
      spec: { ipFrom: 1 },
      options: { typeHint: TYPE_HINT_BIGINT_UNSIGNED },
    })
  })

  it('builds unique and sparse together', () => {
    expect(repib.asc('code').unique().sparse().build().options).toEqual({
      unique: true,
      sparse: true,
    })
  })

  it('builds text, 2dsphere, ttl and lowercase options', () => {
    expect(repib.text('description').build().spec).toEqual({
      description: 'text',
    })
    expect(repib.geo2dsphere('location').build().spec).toEqual({
      location: '2dsphere',
    })
    expect(
      repib.asc('expiresAt').expireAfterSeconds(60).lowercase().build().options
    ).toEqual({ expireAfterSeconds: 60, lowercase: true })
  })

  it('omits options when none are set', () => {
    expect(repib.asc('a').build()).toEqual({ spec: { a: 1 } })
  })

  it('does not share state between builds', () => {
    const builder = repib.asc('a')
    const first = builder.build()
    builder.unique()
    expect(first.options).toBeUndefined()
  })
})
