import type { tags as t } from '@datacapy/schema'

class Audited {
  createdBy?: string
  touch(): void {}
}

/** @schema author */
export class Author extends Audited {
  name!: string & t.Trim
}

/** @schema post strict */
export class Post {
  title!: string
  author!: Author
  reviewer?: Author | null

  save(): void {}
}
