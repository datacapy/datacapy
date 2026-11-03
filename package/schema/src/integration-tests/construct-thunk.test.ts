import Schema from '../schema'
import { SchemaBuilder as sb } from '../builder/schema-builder'

class Thing {
  constructor(public data: { n?: number } | undefined) {}
  double() {
    return (this.data?.n ?? 0) * 2
  }
}

class Things extends Array<Thing> {
  fromArray(data: { n?: number }[]) {
    data.forEach((d) => this.push(new Thing(d)))
    return this
  }
}

describe('construct thunks in applyTransients', () => {
  it('resolves a $construct thunk when applied, not when declared', () => {
    let late: typeof Thing | undefined
    const schema = new Schema({
      thing: { $type: 'Object', $construct: () => late },
    })
    late = Thing
    const result = schema.applyTransients({ thing: { n: 2 } })
    expect(result.thing).toBeInstanceOf(Thing)
    expect(result.thing.double()).toBe(4)
  })

  it('still accepts a class and a registered name', () => {
    const schema = new Schema(
      {
        a: { $type: 'Object', $construct: Thing },
        b: { $type: 'Object', $construct: 'Thing' },
      },
      { constructors: [Thing] }
    )
    const result = schema.applyTransients({ a: { n: 1 }, b: { n: 1 } })
    expect(result.a).toBeInstanceOf(Thing)
    expect(result.b).toBeInstanceOf(Thing)
  })

  it('resolves a $constructCollection thunk', () => {
    const schema = new Schema({
      things: { $type: 'Array', $constructCollection: () => Things },
    })
    const result = schema.applyTransients({ things: [{ n: 1 }, { n: 2 }] })
    expect(result.things).toBeInstanceOf(Things)
    expect(result.things[1]).toBeInstanceOf(Thing)
  })

  it('wraps each array item with an item-level thunk', () => {
    const schema = sb.schema('holder').shape({
      things: sb.array(sb.object().construct(() => Thing)),
    })
    const result = new Schema(schema).applyTransients({
      things: [{ n: 1 }, { n: 3 }],
    })
    expect(result.things[1]).toBeInstanceOf(Thing)
    expect(result.things[1].double()).toBe(6)
  })

  it('names the field when a thunk does not return a class', () => {
    const schema = new Schema({
      thing: { $type: 'Object', $construct: () => undefined },
    })
    expect(() => schema.applyTransients({ thing: { n: 1 } })).toThrow(/thing/)
  })
})
