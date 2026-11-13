// Generated from note.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema } from '@datacapy/schema'
import type { NoteData } from './note'

export class SchemaNote extends Schema.from(
  sb.schema('note').shape({
    _id: sb.string().init('x'),
    title: sb.string().default('untitled').maxLength(200).trim(),
    email: sb.string().email().encrypt(),
    status: sb.string().required().inArray(['draft', 'published']),
    slug: sb.string().required().regex('^[a-z0-9-]+$').label('Slug'),
    count: sb.number().default(0),
    pinned: sb.boolean().required(),
    owner: sb.string().required().notNull(),
    rows: sb
      .array(
        sb
          .object({
            name: sb.string().required(),
            ref: sb
              .object()
              .as<NonNullable<NonNullable<NonNullable<NoteData['rows']>[number]>['ref']>>()
              .strict(false),
          })
          .required(),
      )
      .required(),
    place: sb
      .object({
        x: sb.number().required(),
        label: sb.string().required(),
        tag: sb.string().required().nullable(),
      })
      .required()
      .init({ x: 1, label: 'a', tag: null }),
    tags: sb.array(sb.string().required().lowercase()).required(),
    modes: sb.array(sb.string().required()).required().default(['a', 'b']),
    createdAt: sb.date().default('now'),
    closedAt: sb.date().default(null),
    note: sb.string().default('n').optional(),
    extra: sb.mixed(),
    link: sb.mixed().relation(),
    meta: sb.object().as<Record<string, unknown>>().default({}),
    mode: sb.string().required().default('a').inArray(['a', 'b']),
    kind: sb.string().required().inArray<string>(['a', 'b']),
    code: sb.string().required().default('x'),
    entries: sb.array().as<NonNullable<NoteData['entries']>[number]>().default([]),
    byLang: sb.object().as<NonNullable<NoteData['byLang']>>().default({}).strict(false),
  }),
) {}

const _checkSchemaNote: AssertSchema<SchemaNote, NoteData> = true
void _checkSchemaNote
