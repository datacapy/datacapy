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
    // Remove extra whitespace and trim the result
    value = value.replace(/\s+/g, ' ').trim()
    return value
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
