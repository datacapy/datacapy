import type { tags as t } from '@datacapy/schema'

import type { AuthorData } from './author'

/** @schema post */
export interface PostData {
  _id: string & t.InitFn<'genId'>
  createdAt: Date & t.DefaultFn<'now'>
  slug: string & t.Validate<'slugUnique'> & t.Filter<'stripEmoji'>
  author: AuthorData & t.Relation
  reviewer?: AuthorData | null
  geo: { lat: number; lng: number; label?: string & t.Trim }
  history: { at: Date & t.Default<'now'>; by: string }[]
  body: ParagraphData | ImageData
}

/** @schema paragraph */
export interface ParagraphData {
  kind: 'paragraph'
  text: string
}

/** @schema image */
export interface ImageData {
  kind: 'image'
  url: string
}
