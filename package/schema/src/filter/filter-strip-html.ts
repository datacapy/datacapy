// cspell:ignore formaction xlink
import { FilterAbstract } from './filter-abstract'

const entities = [
  ['amp', '&'],
  ['apos', "'"],
  ['#x27', "'"],
  ['#x2F', '/'],
  ['#39', "'"],
  ['#47', '/'],
  ['lt', '<'],
  ['gt', '>'],
  ['nbsp', ' '],
  ['quot', '"'],
]

// Attributes whose value is a URI - checked against a scheme allow-list so
// an allow-listed tag can't carry a javascript:/data: payload.
const URI_ATTRIBUTES = [
  'href',
  'src',
  'action',
  'formaction',
  'poster',
  'background',
  'xlink:href',
]
const ALLOWED_URI_SCHEMES = ['http', 'https', 'mailto']

export type FilterStripHtmlOptions = {
  allowTags: string[]
}

export class FilterStripHtml extends FilterAbstract {
  filter(value: any, options?) {
    if (typeof value == 'string') value = this.stripHtml(value, options)
    return value
  }

  stripHtml(value: string, options: FilterStripHtmlOptions): string {
    value = this.decodeEntities(value)
    // Create a regular expression that matches all HTML tags
    // except for the allowed ones
    const allowedTags = options?.allowTags || []
    const tagsRegex = new RegExp(
      `<(?!\\/?(?:${allowedTags.join('|')})(?:\\s|>))\/?[^>]+>`,
      'gi'
    )
    // Replace all matched tags with an empty string
    value = value.replace(tagsRegex, ' ')

    // Every tag surviving the pass above is one of the allow-listed names -
    // its attributes are never checked by the pass above (allow-listing a
    // tag name is not allow-listing its attributes), so sanitise them here:
    // strip event-handler attributes and disallow unsafe URI schemes.
    if (allowedTags.length) {
      const allowedTagRegex = new RegExp(
        `<\\/?(?:${allowedTags.join('|')})\\b[^>]*>`,
        'gi'
      )
      value = value.replace(allowedTagRegex, (tag) =>
        this.sanitizeTagAttributes(tag)
      )
    }

    // Remove extra whitespace and trim the result
    value = value.replace(/\s+/g, ' ').trim()
    return value
  }

  /**
   * Strips event-handler attributes (onclick, onerror, ...) and any URI
   * attribute (href, src, ...) whose scheme isn't allow-listed, from a
   * single already-allow-listed tag. Closing tags (no attributes) and
   * self-closing tags pass through unchanged apart from that filtering.
   */
  private sanitizeTagAttributes(tag: string): string {
    const match = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>$/.exec(tag)
    if (!match) return tag
    const [, closingSlash, tagName, rawRest] = match
    if (closingSlash) return tag // closing tags carry no attributes

    const selfClosing = /\/\s*$/.test(rawRest)
    const attrsSource = selfClosing ? rawRest.replace(/\/\s*$/, '') : rawRest

    const attrRegex =
      /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
    let sanitizedAttrs = ''
    let attrMatch: RegExpExecArray | null
    while ((attrMatch = attrRegex.exec(attrsSource)) !== null) {
      const [, name, , dq, sq, unquoted] = attrMatch
      if (!name) continue
      const lowerName = name.toLowerCase()

      // Event-handler attributes execute script unconditionally - never
      // allowed regardless of value.
      if (lowerName.startsWith('on')) continue

      const hasValue =
        dq !== undefined || sq !== undefined || unquoted !== undefined
      const value = dq ?? sq ?? unquoted ?? ''

      if (
        hasValue &&
        URI_ATTRIBUTES.includes(lowerName) &&
        !this.isAllowedUri(value)
      ) {
        continue
      }

      sanitizedAttrs += hasValue
        ? ` ${name}="${value.replace(/"/g, '&quot;')}"`
        : ` ${name}`
    }

    return `<${tagName}${sanitizedAttrs}${selfClosing ? ' /' : ''}>`
  }

  /**
   * A URI with no scheme (relative, anchor, protocol-relative-less path) is
   * allowed; a URI with a scheme must be on the allow-list. Control
   * characters and whitespace are stripped before checking the scheme,
   * since browsers ignore them there too - e.g. "java\tscript:" is treated
   * as "javascript:" by some parsers, so it must not slip through as if it
   * had no scheme at all.
   */
  private isAllowedUri(value: string): boolean {
    // eslint-disable-next-line no-control-regex
    const normalized = value.replace(/[\x00-\x20\x7f]/g, '')
    const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized)
    if (!schemeMatch) return true
    return ALLOWED_URI_SCHEMES.includes(schemeMatch[1].toLowerCase())
  }

  decodeEntities(text: string) {
    for (var i = 0, max = entities.length; i < max; ++i)
      text = text.replace(
        new RegExp('&' + entities[i][0] + ';', 'g'),
        entities[i][1]
      )

    return text
  }

  getName() {
    return 'stripHtml'
  }
}

export default FilterStripHtml
