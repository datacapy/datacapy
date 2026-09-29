// Extending Array doesn't really work in as you might expect
// - because JavaScript uses prototypal inheritance
// - the Array returned by mutator methods is always has constructor Array
// - rather than the extended constructor.
// - https://blog.simontest.net/extend-array-with-typescript-965cc1134b3
// Understanding this, we match this behaviour
// - always return Array type from mutators
export class Collection<T> extends Array<T> {
  fromArray(data: T[]): Collection<T> {
    return new (this.constructor as any)(...data)
  }

  groupByProp(propertyName: string): { [key: string]: Collection<T> } {
    const groupedArrays = this.reduce(
      (acc, item) => {
        const key = String(item[propertyName])
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(item)
        return acc
      },
      {} as { [key: string]: T[] }
    )

    const result: { [key: string]: Collection<T> } = {}
    for (const [key, array] of Object.entries(groupedArrays)) {
      result[key] = this.fromArray(array)
    }

    return result
  }

  moveUp(index: number) {
    const indexLast = this.length - 1
    const indexTo = index > 0 ? index - 1 : indexLast
    this.moveElement(index, indexTo)
  }

  moveDown(index: number) {
    const indexLast = this.length - 1
    const indexTo = index < indexLast ? index + 1 : 0
    this.moveElement(index, indexTo)
  }

  moveElement(indexFrom: number, indexTo: number) {
    const element = this[indexFrom]
    this.splice(indexFrom, 1)
    this.splice(indexTo, 0, element)
  }
}

export default Collection
