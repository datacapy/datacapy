// Compile-time tests for the tag types, checked by `tsc -p tsconfig.types.json`.
import type { tags as t } from './index'

// plain values stay assignable to tagged types
const trimmed: string & t.Trim = 'hello'
const bounded: string & t.Trim & t.MaxLength<200> & t.NotEmpty = 'hello'
const email: (string & t.Email & t.Encrypt) | undefined = undefined
const count: number & t.Default<0> = 3
const when: Date & t.Default<'now'> = new Date()
const status: ('draft' | 'published') & t.Label<'Status'> = 'draft'
const names: (string & t.Lowercase)[] = ['a', 'b']
const nullable: (string & t.Trim) | null = null

// a tagged value is still its base type
const asString: string = bounded
const asNumber: number = count

// tagged properties in an interface can be omitted from a literal only when optional
interface Note {
  title: string & t.Default<'untitled'> & t.Trim
  slug?: string & t.Pattern<'^[a-z0-9-]+$'> & t.Validate<'slugUnique'>
}
const note: Note = { title: 'x' }

// @ts-expect-error a tagged string is still a string, not a number
const wrong: string & t.Trim = 5

export {
  wrong,
  trimmed,
  bounded,
  email,
  count,
  when,
  status,
  names,
  nullable,
  asString,
  asNumber,
  note,
}
