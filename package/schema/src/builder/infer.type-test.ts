// Compile-time tests for Infer. Checked by `tsc -p tsconfig.types.json`
// (strictNullChecks on), never run. A failing case is a type error.
import { SchemaBuilder as sb } from './index'
import { Schema } from '../schema'
import type { Infer } from './infer'

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
function expectType<_T extends true>() {}

// required() and default() make a key non-optional; others are optional
const user = {
  _id: sb.string().required(),
  name: sb.string().default('x'),
  nickname: sb.string(),
  age: sb.number().required().nullable(),
  createdAt: sb.date().default('now'),
  active: sb.boolean().required(),
}
expectType<
  Equal<
    Infer<typeof user>,
    {
      _id: string
      name: string
      createdAt: Date
      active: boolean
      age: number | null
      nickname?: string
    }
  >
>()

// default(null) makes the field nullable
const closable = { closedAt: sb.date().default(null) }
expectType<Equal<Infer<typeof closable>, { closedAt: Date | null }>>()

// chained string methods keep the type
const trimmed = sb.string().required().trim().length(1, 280)
expectType<Equal<Infer<typeof trimmed>, string>>()

// inArray narrows to a literal union
const role = { role: sb.string().inArray(['admin', 'user']).required() }
expectType<Equal<Infer<typeof role>, { role: 'admin' | 'user' }>>()

// arrays and objects
const nested = {
  tags: sb.array(sb.string().required()).required(),
  address: sb
    .object({ street: sb.string().required(), line2: sb.string() })
    .required(),
}
expectType<
  Equal<
    Infer<typeof nested>,
    {
      tags: string[]
      address: { street: string; line2?: string }
    }
  >
>()

// as<T>() states the type of an object or array the spec cannot express
const stated = {
  options: sb.object().as<Record<string, unknown>>().default({}),
  rows: sb.array().as<{ id: string }>().default([]),
}
expectType<
  Equal<
    Infer<typeof stated>,
    { options: Record<string, unknown>; rows: { id: string }[] }
  >
>()

// markers survive shape(), as(), of() and matchAll()
const chained = {
  address: sb.object().default(null).shape({ city: sb.string().required() }),
  tags: sb.array().nullable().of(sb.string().required()),
  byName: sb.object().required().matchAll(sb.number()),
}
expectType<
  Equal<
    Infer<typeof chained>,
    {
      address: { city: string } | null
      byName: Record<string, number>
      tags?: string[] | null
    }
  >
>()

// or() gives a union; mixed() is unknown until as<T>() states it
const alt = {
  id: sb.or([sb.string(), sb.number()]).required(),
  blob: sb.mixed().required(),
  typed: sb.mixed().as<{ a: 1 }>().required(),
}
expectType<
  Equal<
    Infer<typeof alt>,
    { id: string | number; blob: unknown; typed: { a: 1 } }
  >
>()

// spreading a shape and overriding a field
const overridden = { ...user, name: sb.string().required().length(1, 5) }
expectType<Equal<Infer<typeof overridden>['name'], string>>()

// builders and schemas infer the same as the bare shape
const built = new Schema(sb.schema('u').shape(user))
expectType<Equal<Infer<typeof built>, Infer<typeof user>>>()
const builder = sb.schema('u').shape(user)
expectType<Equal<Infer<typeof builder>, Infer<typeof user>>>()

// lazy references carry the referenced type, in objects and arrays
const l10n = new Schema(sb.schema('l10n').shape({ en: sb.string().required() }))
const refs = {
  title: sb.ref(() => l10n).required(),
  maybe: sb
    .object()
    .schema(() => l10n)
    .nullable(),
  list: sb
    .array()
    .of(() => l10n)
    .required(),
}
expectType<
  Equal<
    Infer<typeof refs>,
    {
      title: { en: string }
      list: { en: string }[]
      maybe?: { en: string } | null
    }
  >
>()

// a recursive schema needs one annotation to break the initialiser cycle
interface Section {
  title: string
  sections: Section[]
}
const sectionShape = {
  title: sb.string().required(),
  sections: sb
    .array()
    .of((): Schema<unknown> => sectionSchema)
    .required(),
}
const sectionSchema: Schema<typeof sectionShape> = new Schema(
  sb.schema('section').shape(sectionShape)
)
export type { Section }
