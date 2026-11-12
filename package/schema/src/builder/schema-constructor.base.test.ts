import { SchemaConstructor } from './schema-constructor'

class Note extends SchemaConstructor<Note> {
  declare text: string
  declare owner?: string
  declare pinned: boolean

  greeting() {
    return `Hello, ${this.owner}`
  }
}

describe('SchemaConstructor<T> as a base class', () => {
  it('copies the data onto the instance, with methods intact', () => {
    const note = new Note({ text: 'Hi', owner: 'kevin' })
    expect(note).toBeInstanceOf(Note)
    expect(note.text).toBe('Hi')
    expect(note.greeting()).toBe('Hello, kevin')
  })

  it('accepts no data and null', () => {
    expect(new Note().text).toBeUndefined()
    expect(new Note(null).text).toBeUndefined()
  })

  it('does not fill defaults', () => {
    expect(new Note({ text: 'Hi' }).pinned).toBeUndefined()
  })
})
