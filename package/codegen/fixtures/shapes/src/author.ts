import type { tags as t } from '@datacapy/schema'

import type { PostData } from './post'

/** @schema author */
export interface AuthorData {
  name: string & t.Trim
  posts?: PostData[]
}
