// Generated from post.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema, SpecFor } from '@datacapy/schema'
import type { Author, Post } from './post'

export class SchemaAuthor extends Schema.from(
  sb.schema('author').construct('Author').shape({
    name: sb.string().required().trim(),
    createdBy: sb.string(),
  }),
) {}

const _checkSchemaAuthor: AssertSchema<SchemaAuthor, Pick<Author, 'name' | 'createdBy'>> = true
void _checkSchemaAuthor

export class SchemaPost extends Schema.from(
  sb
    .schema('post')
    .construct('Post')
    .strict()
    .shape({
      title: sb.string().required(),
      author: sb.refTo<SpecFor<Author>>((): unknown => new SchemaAuthor()).required(),
      reviewer: sb.refTo<SpecFor<Author>>((): unknown => new SchemaAuthor()).nullable(),
    }),
) {}

const _checkSchemaPost: AssertSchema<SchemaPost, Pick<Post, 'title' | 'author' | 'reviewer'>> = true
void _checkSchemaPost
