// Generated from post.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema, SpecFor } from '@datacapy/schema'
import type { PostData, ParagraphData, ImageData } from './post'
import { SchemaAuthor } from './author.schema'
import type { AuthorData } from './author'
import { filters, initialisers, validators } from './registry'

export class SchemaPost extends Schema.from(
  sb.schema('post').shape({
    _id: sb.string().init(initialisers.genId),
    createdAt: sb.date().default(initialisers.now),
    slug: sb.string().required().validate(validators.slugUnique).filter(filters.stripEmoji),
    author: sb
      .refTo<SpecFor<AuthorData>>((): unknown => SchemaAuthor)
      .required()
      .relation(),
    reviewer: sb.refTo<SpecFor<AuthorData>>((): unknown => SchemaAuthor).nullable(),
    geo: sb
      .object({
        lat: sb.number().required(),
        lng: sb.number().required(),
        label: sb.string().trim(),
      })
      .required(),
    history: sb
      .array(sb.object({ at: sb.date().default('now'), by: sb.string().required() }).required())
      .required(),
    body: sb
      .or([
        sb.refTo<SpecFor<ParagraphData>>((): unknown => SchemaParagraph),
        sb.refTo<SpecFor<ImageData>>((): unknown => SchemaImage),
      ])
      .required(),
  }),
) {}

const _checkSchemaPost: AssertSchema<SchemaPost, PostData> = true
void _checkSchemaPost

export class SchemaParagraph extends Schema.from(
  sb.schema('paragraph').shape({
    kind: sb.string().required().inArray(['paragraph']),
    text: sb.string().required(),
  }),
) {}

const _checkSchemaParagraph: AssertSchema<SchemaParagraph, ParagraphData> = true
void _checkSchemaParagraph

export class SchemaImage extends Schema.from(
  sb.schema('image').shape({
    kind: sb.string().required().inArray(['image']),
    url: sb.string().required(),
  }),
) {}

const _checkSchemaImage: AssertSchema<SchemaImage, ImageData> = true
void _checkSchemaImage
