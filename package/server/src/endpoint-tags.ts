// Type-only tags that describe how a service method parameter is read from the
// request. The endpoint generator reads them; nothing here exists at runtime.
// Each tag is an optional phantom property with a unique `$dc:` key, so a plain
// value stays assignable (`const id: string & Param = 'x'` compiles) and tags
// combine with `&`.
import type { tags as schemaTags } from '@datacapy/om'

/** Read from the URL path (`src: 'param'`). The name must appear as `:name` in the route. */
export type Param = { readonly '$dc:param'?: true }
/** Read from the query string (`src: 'query'`, the default source). */
export type Query = { readonly '$dc:query'?: true }
/** Read from the parsed request body (`src: 'body'`). */
export type Body = { readonly '$dc:body'?: true }
/** Read from a request header (`src: 'header'`, `srcPath` is the header name). */
export type Header<Name extends string> = { readonly '$dc:header'?: Name }
/** Read from the server config by dotted path (`src: 'config'`). */
export type Config<Path extends string> = { readonly '$dc:config'?: Path }
/** Read from the Express request by dotted path (`src: 'request'`), for example `ip`. */
export type Request<Path extends string> = { readonly '$dc:request'?: Path }
/** Read from the request container by dotted path (`src: 'container'`). */
export type Container<Path extends string> = {
  readonly '$dc:container'?: Path
}
/** The framework sets this on the params object after parsing; it emits no `data` entry. */
export type AclContext = { readonly '$dc:aclContext'?: true }
/** The framework sets this on the params object after parsing; it emits no `data` entry. */
export type AclConditions = { readonly '$dc:aclConditions'?: true }

/** Value used when the request omits the field (`defaultValue`). Same tag as the schema package. */
export type Default<V extends string | number | boolean | null> =
  schemaTags.Default<V>
