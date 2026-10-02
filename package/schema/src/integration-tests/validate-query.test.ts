import Schema, { SchemaQuery } from 'schema'
import { sb } from '../builder'

describe('validateQuery', () => {
  it('should cast query parameters', async () => {
    const data = {
      name: { $eq: 123 },
      age: { $lt: '33' },
      cityId: { $in: ['10', '11', '12'] },
      countryId: { $nin: [13, 14, 15] },
    } as SchemaQuery

    const schema = new Schema({
      name: String,
      age: Number,
      cityId: Number,
      countryId: String,
    })

    await schema.validateQuery(data)

    expect(data.name.$eq).toBe('123')
    expect(data.name.$eq.constructor).toBe(String)
    expect(data.age.$lt).toBe(33)
    expect(data.age.$lt.constructor).toBe(Number)
    expect(data.cityId.$in).toEqual([10, 11, 12])
    expect(data.cityId.$in[0].constructor).toBe(Number)
    expect(data.cityId.$in[1].constructor).toBe(Number)
    expect(data.cityId.$in[2].constructor).toBe(Number)
    expect(data.countryId.$nin).toEqual(['13', '14', '15'])
    expect(data.countryId.$nin[0].constructor).toBe(String)
    expect(data.countryId.$nin[1].constructor).toBe(String)
    expect(data.countryId.$nin[2].constructor).toBe(String)
  })

  it('should cast query parameters within conditional $or', async () => {
    const data = {
      $or: [{ name: { $eq: 123 } }, { name: { $eq: 456 } }],
    } as SchemaQuery

    const schema = new Schema({
      name: String,
    })

    await schema.validateQuery(data)

    expect(data.$or[0].name.$eq).toBe('123')
    expect(data.$or[0].name.$eq.constructor).toBe(String)
    expect(data.$or[1].name.$eq).toBe('456')
    expect(data.$or[1].name.$eq.constructor).toBe(String)
  })

  it('should cast query parameters of $in operator', async () => {
    const data = {
      name: { $in: [123, 456, 789] },
    } as SchemaQuery

    const schema = new Schema({
      name: String,
    })

    await schema.validateQuery(data)

    expect(data.name.$in[0]).toBe('123')
    expect(data.name.$in[0].constructor).toBe(String)
    expect(data.name.$in[1]).toBe('456')
    expect(data.name.$in[1].constructor).toBe(String)
    expect(data.name.$in[2]).toBe('789')
    expect(data.name.$in[2].constructor).toBe(String)
  })

  it('should cast query parameters of $nin operator', async () => {
    const data = {
      name: { $nin: [123, 456, 789] },
    } as SchemaQuery

    const schema = new Schema({
      name: String,
    })

    await schema.validateQuery(data)

    expect(data.name.$nin[0]).toBe('123')
    expect(data.name.$nin[0].constructor).toBe(String)
    expect(data.name.$nin[1]).toBe('456')
    expect(data.name.$nin[1].constructor).toBe(String)
    expect(data.name.$nin[2]).toBe('789')
    expect(data.name.$nin[2].constructor).toBe(String)
  })

  it('should cast query parameters within conditional $and', async () => {
    const data = {
      $and: [{ name: { $eq: 123 } }, { age: { $eq: '35' } }],
    } as SchemaQuery

    const schema = new Schema({
      name: String,
      age: Number,
    })

    await schema.validateQuery(data)

    expect(data.$and[0].name.$eq).toBe('123')
    expect(data.$and[0].name.$eq.constructor).toBe(String)
    expect(data.$and[1].age.$eq).toBe(35)
    expect(data.$and[1].age.$eq.constructor).toBe(Number)
  })

  it('should cast query parameters within nested conditionals', async () => {
    const data = {
      $or: [
        {
          $and: [{ name: { $eq: 123 } }, { age: { $eq: '35' } }],
        },
        {
          $and: [{ name: { $in: [456] } }, { age: { $nin: ['37'] } }],
        },
      ],
    } as SchemaQuery

    const schema = new Schema({
      name: String,
      age: Number,
    })

    await schema.validateQuery(data)

    expect(data.$or[0].$and[0].name.$eq).toBe('123')
    expect(data.$or[0].$and[0].name.$eq.constructor).toBe(String)
    expect(data.$or[0].$and[1].age.$eq).toBe(35)
    expect(data.$or[0].$and[1].age.$eq.constructor).toBe(Number)
    expect(data.$or[1].$and[0].name.$in[0]).toBe('456')
    expect(data.$or[1].$and[0].name.$in[0].constructor).toBe(String)
    expect(data.$or[1].$and[1].age.$nin[0]).toBe(37)
    expect(data.$or[1].$and[1].age.$nin[0].constructor).toBe(Number)
  })

  it('should not validate $regex/$options operands against a field format validator', async () => {
    // A $regex search pattern (or its $options match flags) is not itself a
    // value of the field - it should not have to satisfy the field's own
    // format constraints, e.g. a substring search against a domain-shaped
    // field need not itself look like a domain.
    const data = {
      subdomain: { $regex: 'acme', $options: 'i' },
    } as SchemaQuery

    const schema = new Schema(
      sb
        .schema('workspace')
        .shape({
          subdomain: sb.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/),
        })
        .build()
    )

    const result = await schema.validateQuery(data)

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })
})
