import { getMimeType } from 'hono/utils/mime'

const CHARSET_TYPES =
  /^(text\/|application\/(json|javascript|xml)|.+\+(json|xml))/i

/** Adds `charset=utf-8` to text-like types, as Express's `res.type` does. */
export function withCharset(contentType: string): string {
  if (/;\s*charset=/i.test(contentType)) return contentType
  return CHARSET_TYPES.test(contentType)
    ? `${contentType}; charset=utf-8`
    : contentType
}

/** A full media type, or a bare extension such as `json` or `csv`. */
export function resolveContentType(type: string): string {
  if (type.includes('/')) return withCharset(type)
  const mime = getMimeType(`file.${type.replace(/^\./, '')}`)
  return withCharset(mime ?? 'application/octet-stream')
}

export function contentTypeForFile(filename: string): string {
  return withCharset(getMimeType(filename) ?? 'application/octet-stream')
}

/** The media type of a Content-Type header, lower-cased, without parameters. */
export function mediaType(header: string | undefined): string {
  return (header ?? '').split(';')[0].trim().toLowerCase()
}
