// Compile-time tests for the endpoint tag types, checked by `tsc --noEmit`.
import type { tagsEndpoint as e } from './index'

// plain values stay assignable to tagged types
const surveyId: string & e.Param = 'abc'
const projectId: string & e.Header<'X-Project-Id'> = 'p1'
const changes: { id: string }[] & e.Body = [{ id: 'a' }]
const page: number & e.Query & e.Default<1> = 3
const ip: string & e.Request<'ip'> = '127.0.0.1'
const mode: string & e.Config<'app.mode'> = 'dev'
const nested: string & e.Container<'aclContext.user'> = 'u'
const ctx: e.AclContext = {}
const cond: e.AclConditions = {}

// a tagged value is still its base type
const asString: string = surveyId
const asNumber: number = page

// tagged properties work in an inline params type, optional ones may be omitted
function method(args: {
  surveyId: string & e.Param
  projectId: string & e.Header<'X-Project-Id'>
  orderedNames?: string[] & e.Body
  aclContext?: e.AclContext
}): void {
  void args
}
method({ surveyId: 'a', projectId: 'p' })

// @ts-expect-error a tagged string is still a string, not a number
const wrong: string & e.Param = 5

// @ts-expect-error a header tag needs the header name
type NoName = e.Header

export {
  surveyId,
  projectId,
  changes,
  page,
  ip,
  mode,
  nested,
  ctx,
  cond,
  asString,
  asNumber,
  wrong,
}
export type { NoName }
