import { Collection } from './collection'

describe('Collection.groupByProp', () => {
  it('should group items by the specified property', () => {
    const collection = new Collection(
      { id: 1, category: 'A', value: 10 },
      { id: 2, category: 'B', value: 20 },
      { id: 3, category: 'A', value: 30 },
      { id: 4, category: 'C', value: 40 },
      { id: 5, category: 'B', value: 50 }
    )

    const grouped = collection.groupByProp('category')

    expect(Object.keys(grouped)).toEqual(['A', 'B', 'C'])
    expect(grouped['A']).toBeInstanceOf(Collection)
    expect(grouped['A'].length).toBe(2)
    expect(grouped['B'].length).toBe(2)
    expect(grouped['C'].length).toBe(1)
    expect(grouped['A'][0].id).toBe(1)
    expect(grouped['A'][1].id).toBe(3)
    expect(grouped['B'][0].id).toBe(2)
    expect(grouped['B'][1].id).toBe(5)
    expect(grouped['C'][0].id).toBe(4)
  })

  it('should handle empty collections', () => {
    const collection = new Collection<any>()
    const grouped = collection.groupByProp('someProperty')
    expect(Object.keys(grouped)).toEqual([])
  })

  it('should handle collections with undefined property values', () => {
    const collection = new Collection(
      { id: 1, category: 'A' },
      { id: 2, category: undefined },
      { id: 3, category: 'B' },
      { id: 4 }
    )

    const grouped = collection.groupByProp('category')

    expect(Object.keys(grouped)).toEqual(['A', 'undefined', 'B'])
    expect(grouped['A'].length).toBe(1)
    expect(grouped['undefined'].length).toBe(2)
    expect(grouped['B'].length).toBe(1)
  })

  it('should handle non-string property values', () => {
    const collection = new Collection(
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 10 },
      { id: 4, value: 30 }
    )

    const grouped = collection.groupByProp('value')

    expect(Object.keys(grouped)).toEqual(['10', '20', '30'])
    expect(grouped['10'].length).toBe(2)
    expect(grouped['20'].length).toBe(1)
    expect(grouped['30'].length).toBe(1)
  })
})
