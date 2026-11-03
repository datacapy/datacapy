import { Schema } from '../schema'
import { SchemaBuilder as sb } from './schema-builder'
import { SchemaConstructor } from './schema-constructor'

class SchemaNote extends Schema.from(
  sb.schema('note').shape({
    _id: sb.string().required().init('x'),
    title: sb.string().default('untitled'),
    pinned: sb.boolean().default(false),
    tag: sb.string(),
  })
) {}

class Note extends SchemaConstructor.from(SchemaNote) {
  label() {
    return `${this.title}!`
  }
}

describe('SchemaConstructor.from', () => {
  it('fills defaults and keeps given values', () => {
    expect(new Note()).toMatchObject({ _id: 'x', title: 'untitled' })
    expect(new Note({ title: 'a', tag: 't' })).toMatchObject({
      title: 'a',
      tag: 't',
    })
  })

  it('accepts null data', () => {
    expect(new Note(null).pinned).toBe(false)
  })

  it('keeps instanceof, name and class-body methods', () => {
    const note = new Note({ title: 'a' })
    expect(note).toBeInstanceOf(Note)
    expect(Note.name).toBe('Note')
    expect(note.label()).toBe('a!')
  })

  it('keeps empty strings and init-fills a missing id', () => {
    expect(new Note({ title: '' }).title).toBe('')
    expect(new Note()._id).toBe('x')
  })
})
