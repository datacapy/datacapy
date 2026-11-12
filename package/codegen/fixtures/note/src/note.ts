import type { tags as t } from '@datacapy/schema'

/** @schema note */
export interface NoteData {
  _id: string & t.Init<'x'>
  title: string & t.Default<'untitled'> & t.Trim & t.MaxLength<200>
  email?: string & t.Email & t.Encrypt
  status: 'draft' | 'published'
  slug: string & t.Pattern<'^[a-z0-9-]+$'> & t.Label<'Slug'>
  count: number & t.Default<0>
  pinned: boolean
  tags: (string & t.Lowercase)[]
  createdAt: Date & t.Default<'now'>
  closedAt: (Date & t.Default<null>) | null
  note?: string & t.Default<'n'>
  extra?: unknown
  meta: Record<string, unknown> & t.Default<{}>
  kind: string & t.OneOf<'a' | 'b'>
  code: string & t.Required & t.Default<'x'>
}
