// Generated from author.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema, SpecFor } from '@datacapy/schema'
import type { AuthorData } from './author'
import { SchemaPost } from './post.schema'
import type { PostData } from './post'

export class SchemaAuthor extends Schema.from(
  sb.schema('author').shape({
    name: sb.string().required().trim(),
    posts: sb.array(sb.refTo<SpecFor<PostData>>((): unknown => SchemaPost).required()),
  }),
) {}

const _checkSchemaAuthor: AssertSchema<SchemaAuthor, AuthorData> = true
void _checkSchemaAuthor
