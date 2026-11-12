import type { tags as t } from '@datacapy/schema'

/** @schema note */
export class Note {
  _id?: string
  text!: string & t.Trim & t.MinLength<1> & t.MaxLength<280>
  owner?: string
  pinned!: boolean & t.Default<false>
  private secret = 'x'
  static count = 0

  constructor(data?: Partial<Note>) {
    Object.assign(this, data)
  }

  greeting(): string {
    return `Hello, ${this.owner}`
  }

  get shout(): string {
    return this.text.toUpperCase()
  }
}
