import { Schema } from '../schema'
import { SchemaBuilder as sb } from './schema-builder'

describe('lazy schema references', () => {
  it('does not call the thunk while building or constructing', () => {
    const thunk = jest.fn(() => {
      throw new Error('resolved too early')
    })
    const schema = new Schema(
      sb.schema('holder').shape({
        child: sb.ref(thunk),
        children: sb.array().of(thunk),
        nested: sb.object().schema(thunk),
      })
    )
    expect(schema.spec.child.$schema).toBeInstanceOf(Function)
    expect(thunk).not.toHaveBeenCalled()
  })

  it('resolves the name when the schema is first used', async () => {
    const thunk = () => child
    const parent = new Schema(
      sb.schema('parent').shape({ child: sb.ref(thunk).required() })
    )
    const child: Schema = new Schema(
      sb.schema('child').shape({ name: sb.string().required() })
    )
    parent.schemas = { child }
    const result = await parent.validate({ child: {} })
    expect(result.isValid).toBe(false)
    expect(JSON.stringify(result.errors)).toContain('name')
  })

  it('throws for an unregistered reference when used', () => {
    const missing = new Schema(sb.schema('missing').shape({}))
    const parent = new Schema(
      sb.schema('parent').shape({ child: sb.ref(() => missing) })
    )
    expect(() => parent.getSpec()).toThrow('Missing schema reference missing')
  })
})
