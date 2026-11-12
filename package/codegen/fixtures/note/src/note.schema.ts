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
    tags: sb.array(sb.string().required().lowercase()).required(),
    createdAt: sb.date().default('now'),
    closedAt: sb.date().default(null),
    note: sb.string().default('n').optional(),
    extra: sb.mixed(),
    meta: sb.object().as<Record<string, unknown>>().default({}),
    kind: sb.string().required().inArray<string>(['a', 'b']),
    code: sb.string().required().default('x'),
  }),
) {}

const _checkSchemaNote: AssertSchema<SchemaNote, NoteData> = true
void _checkSchemaNote
