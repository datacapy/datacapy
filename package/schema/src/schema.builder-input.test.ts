import Schema from './schema'
import { sb } from './builder'

describe('Schema constructor with builder input', () => {
  const build = () =>
    sb.schema('person').shape({
      name: sb.string().required().maxLength(5),
      tags: sb.array(String),
    })

  it('resolves a schema builder to the same spec as build()', () => {
    expect(new Schema(build()).spec).toEqual(new Schema(build().build()).spec)
  })

  it('resolves a field builder to the same spec as build()', () => {
    const field = () => sb.object({ name: sb.string().required() })
    expect(new Schema(field()).spec).toEqual(new Schema(field().build()).spec)
  })

  it('resolves builders nested in a plain object spec', () => {
    const schema = new Schema({ name: sb.string().required() })
    expect(schema.spec).toEqual({ name: sb.string().required().build() })
  })

  it('validates identically for builder and built input', async () => {
    const data = { name: 'too long name' }
    const viaBuilder = await new Schema(build()).validate(data)
    const viaBuilt = await new Schema(build().build()).validate(data)
    expect(viaBuilder.isValid).toBe(false)
    expect(viaBuilder).toEqual(viaBuilt)
  })

  it('still accepts a plain spec and no spec', () => {
    expect(new Schema({ name: { $type: 'string' } }).spec).toEqual({
      name: { $type: 'string' },
    })
    expect(new Schema().spec).toEqual({})
  })
})
