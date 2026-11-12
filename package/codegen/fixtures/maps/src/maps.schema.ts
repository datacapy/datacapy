// Generated from maps.ts by datacapy-gen. Do not edit.
// cspell:disable
import { Schema, SchemaBuilder as sb } from '@datacapy/schema'
import type { AssertSchema, SpecFor } from '@datacapy/schema'
import type { L10nData, ThingData } from './maps'

export class SchemaL10n extends Schema.from(
  sb.schema('l10n').construct('L10n').strict().matchAll(sb.string().trim()),
) {}

const _checkSchemaL10n: AssertSchema<SchemaL10n, L10nData> = true
void _checkSchemaL10n

export class SchemaThing extends Schema.from(
  sb
    .schema('thing')
    .strict()
    .shape({
      title: sb.refTo<SpecFor<L10nData>>((): unknown => new SchemaL10n()).required(),
      attributes: sb.object().matchAll(sb.string().stripHtml()).required(),
      counts: sb.object().matchAll(sb.number()).required(),
      meta: sb.object().as<Record<string, unknown>>().required(),
      raw: sb.object().as<object>(),
      optionalMap: sb.object().matchAll(sb.string()),
      nullableMap: sb.object().matchAll(sb.boolean()).required().nullable(),
    }),
) {}

const _checkSchemaThing: AssertSchema<SchemaThing, ThingData> = true
void _checkSchemaThing
