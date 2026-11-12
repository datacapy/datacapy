// Generated from options.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema } from '@datacapy/schema'
import type { StrictThingData, LooseThingData, PlainThingData } from './options'

export class SchemaStrictThing extends Schema.from(
  sb
    .schema('strict-thing')
    .construct('StrictThing')
    .constructCollection('StrictThingCollection')
    .strict()
    .shape({
      name: sb.string().required(),
    }),
) {}

const _checkSchemaStrictThing: AssertSchema<SchemaStrictThing, StrictThingData> = true
void _checkSchemaStrictThing

export class SchemaLooseThing extends Schema.from(
  sb.schema('loose-thing').shape({
    name: sb.string().required(),
  }),
) {}

const _checkSchemaLooseThing: AssertSchema<SchemaLooseThing, LooseThingData> = true
void _checkSchemaLooseThing

export class SchemaPlainThing extends Schema.from(
  sb.schema('plain-thing').constructCollection('PlainThingCollection').strict().shape({
    name: sb.string().required(),
  }),
) {}

const _checkSchemaPlainThing: AssertSchema<SchemaPlainThing, PlainThingData> = true
void _checkSchemaPlainThing
