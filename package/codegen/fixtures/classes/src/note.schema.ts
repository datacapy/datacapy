// Generated from note.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema } from '@datacapy/schema'
import type { Note } from './note'

export class SchemaNote extends Schema.from(
  sb
    .schema('note')
    .construct('Note')
    .shape({
      _id: sb.string(),
      text: sb.string().required().minLength(1).maxLength(280).trim(),
      owner: sb.string(),
      pinned: sb.boolean().default(false),
    }),
) {}

const _checkSchemaNote: AssertSchema<
  SchemaNote,
  Pick<Note, '_id' | 'text' | 'owner' | 'pinned'>
> = true
void _checkSchemaNote
