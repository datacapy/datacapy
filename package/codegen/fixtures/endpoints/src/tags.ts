// Same shapes as `tagsEndpoint` in @datacapy/server, copied so the fixture needs no dependency on it.
export type Param = { readonly '$dc:param'?: true }
export type Query = { readonly '$dc:query'?: true }
export type Body = { readonly '$dc:body'?: true }
export type Header<Name extends string> = { readonly '$dc:header'?: Name }
export type Request<Path extends string> = { readonly '$dc:request'?: Path }
export type AclContext = { readonly '$dc:aclContext'?: true }
export type Default<V extends string | number | boolean | null> = { readonly '$dc:default'?: V }
