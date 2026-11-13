import type { tags as t } from '@datacapy/schema'

export interface NoteEntry {
  label: string
}

/** @schema note */
export interface NoteData {
  _id: string & t.Init<'x'>
  title: string & t.Default<'untitled'> & t.Trim & t.MaxLength<200>
  email?: string & t.Email & t.Encrypt
  status: 'draft' | 'published'
  slug: string & t.Pattern<'^[a-z0-9-]+$'> & t.Label<'Slug'>
  count: number & t.Default<0>
  pinned: boolean
  owner: string & t.Required & t.NotNull
  rows: { name: string; ref?: { id: string } & t.Opaque & t.NonStrict }[]
  place: { x: number; label: string; tag: string | null } & t.Required &
    t.Init<{ x: 1; label: 'a'; tag: null }>
  tags: (string & t.Lowercase)[]
  modes: string[] & t.Required & t.Default<['a', 'b']>
  createdAt: Date & t.Default<'now'>
  closedAt: (Date & t.Default<null>) | null
  note?: string & t.Default<'n'>
  extra?: unknown
  link?: unknown & t.Relation
  meta: Record<string, unknown> & t.Default<t.EmptyObject>
  mode: ('a' | 'b') & t.Required & t.Default<'a'>
  kind: string & t.OneOf<'a' | 'b'>
  code: string & t.Required & t.Default<'x'>
  entries: NoteEntry[] & t.Default<t.EmptyArray> & t.Opaque
  byLang: Record<string, NoteEntry> & t.Default<t.EmptyObject> & t.NonStrict & t.Opaque
}
