// Compile-time tests for SpecFor / AssertSpec, checked by `tsc -p tsconfig.types.json`.
import { SchemaBuilder as sb } from '../builder'
import type { AssertSpec, SpecFor, Untag } from './spec-for'
import type { tags as t } from './index'

type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false
function expectType<_T extends true>() {}

interface NoteData {
  _id: string & t.Init<'x'>
  title: string & t.Default<'untitled'> & t.Trim & t.MaxLength<200>
  email?: string & t.Email & t.Encrypt
  status: 'draft' | 'published'
  count: number & t.Default<0>
  tags: (string & t.Lowercase)[]
  createdAt: Date & t.Default<'now'>
  closedAt: (Date & t.Default<null>) | null
  meta: { nested: boolean & t.Label<'Nested'>; note?: string }
}

expectType<
  Equal<
    Untag<NoteData>,
    {
      _id: string
      title: string
      email?: string
      status: 'draft' | 'published'
      count: number
      tags: string[]
      createdAt: Date
      closedAt: Date | null
      meta: { nested: boolean; note?: string }
    }
  >
>()
expectType<Equal<SpecFor<NoteData>, Untag<NoteData>>>()

const spec = {
  _id: sb.string().init('x'),
  title: sb.string().default('untitled').trim().maxLength(200),
  email: sb.string().email().encrypt(),
  status: sb.string().required().inArray(['draft', 'published']),
  count: sb.number().default(0),
  tags: sb.array(sb.string().required().lowercase()).required(),
  createdAt: sb.date().default('now'),
  closedAt: sb.date().default(null),
  meta: sb
    .object({ nested: sb.boolean().required(), note: sb.string() })
    .required(),
}
const ok: AssertSpec<typeof spec, NoteData> = true

// a spec that drifted from the interface does not resolve to true
const drifted = { ...spec, count: sb.string().default('0') }
type Drift = AssertSpec<typeof drifted, NoteData>
expectType<Equal<Drift extends true ? true : false, false>>()

// a missing required marker is caught too
const loose = { ...spec, status: sb.string().inArray(['draft', 'published']) }
type Loose = AssertSpec<typeof loose, NoteData>
expectType<Equal<Loose extends true ? true : false, false>>()

// a tagged literal union matches the schema, and a wrong or missing literal does not
interface ModeData {
  mode: ('a' | 'b') & t.Required & t.Default<'a'>
}
const modeSpec = {
  mode: sb.string().required().inArray(['a', 'b']).default('a'),
}
const modeOk: AssertSpec<typeof modeSpec, ModeData> = true
const wrongMode = {
  mode: sb.string().required().inArray(['a', 'c']).default('a'),
}
type WrongMode = AssertSpec<typeof wrongMode, ModeData>
expectType<Equal<WrongMode extends true ? true : false, false>>()
const fewerModes = { mode: sb.string().required().inArray(['a']).default('a') }
type FewerModes = AssertSpec<typeof fewerModes, ModeData>
expectType<Equal<FewerModes extends true ? true : false, false>>()

export { ok, modeOk }
