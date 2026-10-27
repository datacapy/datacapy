import { FilterStripHtml } from './filter-strip-html'

describe('FilterStripHtml', () => {
  let filter: FilterStripHtml

  beforeEach(() => {
    filter = new FilterStripHtml()
  })

  it('should have correct name', () => {
    expect(filter.getName()).toBe('stripHtml')
  })

  it('should strip simple HTML tags', () => {
    const result = filter.filter('<p>Hello</p>')
    expect(result).toBe('Hello')
  })

  it('should strip multiple tags', () => {
    const result = filter.filter('<p>This is <strong>bold</strong> text</p>')
    expect(result).toBe('This is bold text')
  })

  it('should strip nested tags', () => {
    const result = filter.filter(
      '<div><p>Nested <span>content</span></p></div>'
    )
    expect(result).toBe('Nested content')
  })

  it('should handle self-closing tags', () => {
    const result = filter.filter('Line 1<br/>Line 2')
    expect(result).toBe('Line 1 Line 2')
  })

  it('should collapse multiple spaces', () => {
    const result = filter.filter('<p>Hello</p>   <p>World</p>')
    expect(result).toBe('Hello World')
  })

  it('should decode HTML entities', () => {
    const result = filter.filter('&lt;p&gt;Hello &amp; World&lt;/p&gt;')
    expect(result).toBe('Hello & World')
  })

  it('should decode common HTML entities', () => {
    expect(filter.filter('&amp;')).toBe('&')
    expect(filter.filter('&lt;')).toBe('<')
    expect(filter.filter('&gt;')).toBe('>')
    expect(filter.filter('&quot;')).toBe('"')
    expect(filter.filter('&apos;')).toBe("'")
    expect(filter.filter('&nbsp;')).toBe('')
    expect(filter.filter('Hello&nbsp;World')).toBe('Hello World')
  })

  it('should decode numeric HTML entities', () => {
    expect(filter.filter('&#x27;')).toBe("'")
    expect(filter.filter('&#39;')).toBe("'")
    expect(filter.filter('&#x2F;')).toBe('/')
    expect(filter.filter('&#47;')).toBe('/')
  })

  it('should handle tags with attributes', () => {
    const result = filter.filter('<p class="test" id="paragraph">Content</p>')
    expect(result).toBe('Content')
  })

  it('should handle tags with complex attributes', () => {
    const result = filter.filter(
      '<a href="http://example.com" target="_blank">Link</a>'
    )
    expect(result).toBe('Link')
  })

  it('should preserve allowed tags', () => {
    const result = filter.filter(
      '<p>This is <strong>bold</strong> and <em>italic</em></p>',
      {
        allowTags: ['strong'],
      }
    )
    expect(result).toBe('This is <strong>bold</strong> and italic')
  })

  it('should preserve multiple allowed tags', () => {
    const result = filter.filter(
      '<p>Text with <strong>bold</strong> and <em>italic</em> and <span>span</span></p>',
      {
        allowTags: ['strong', 'em'],
      }
    )
    expect(result).toBe(
      'Text with <strong>bold</strong> and <em>italic</em> and span'
    )
  })

  it('should preserve allowed tags with attributes', () => {
    const result = filter.filter(
      '<p>Link: <a href="test.com" class="link">Click here</a></p>',
      {
        allowTags: ['a'],
      }
    )
    expect(result).toBe('Link: <a href="test.com" class="link">Click here</a>')
  })

  it('should strip a javascript: URI from an allow-listed href attribute', () => {
    const result = filter.filter('<a href="javascript:alert(1)">click</a>', {
      allowTags: ['a'],
    })
    expect(result).toBe('<a>click</a>')
  })

  it('should strip a javascript: URI even with embedded control characters (java\\tscript:)', () => {
    const result = filter.filter('<a href="java\tscript:alert(1)">click</a>', {
      allowTags: ['a'],
    })
    expect(result).not.toContain('script:')
    expect(result).toBe('<a>click</a>')
  })

  it('should allow http/https/mailto URIs on an allow-listed href attribute', () => {
    expect(
      filter.filter('<a href="https://example.com">go</a>', {
        allowTags: ['a'],
      })
    ).toBe('<a href="https://example.com">go</a>')
    expect(
      filter.filter('<a href="mailto:a@example.com">mail</a>', {
        allowTags: ['a'],
      })
    ).toBe('<a href="mailto:a@example.com">mail</a>')
  })

  it('should strip an onerror event-handler attribute from an allow-listed img tag', () => {
    const result = filter.filter('<img src="x" onerror="alert(1)">', {
      allowTags: ['img'],
    })
    expect(result).toBe('<img src="x">')
  })

  it('should strip an onmouseover event-handler attribute even when title carries encoded quotes', () => {
    const result = filter.filter(
      '<a href="test" title="x&quot; onmouseover=&quot;alert(1)">click</a>',
      { allowTags: ['a'] }
    )
    expect(result).not.toContain('onmouseover')
  })

  it('should preserve a self-closing allow-listed tag while stripping its unsafe attributes', () => {
    const result = filter.filter('<img src="x" onerror="alert(1)" />', {
      allowTags: ['img'],
    })
    expect(result).toBe('<img src="x" />')
  })

  it('should handle empty string', () => {
    const result = filter.filter('')
    expect(result).toBe('')
  })

  it('should handle plain text without tags', () => {
    const result = filter.filter('Plain text')
    expect(result).toBe('Plain text')
  })

  it('should handle malformed HTML', () => {
    const result = filter.filter('<p>Unclosed tag')
    expect(result).toBe('Unclosed tag')
  })

  it('should return non-string values unchanged', () => {
    expect(filter.filter(123)).toBe(123)
    expect(filter.filter(null)).toBe(null)
    expect(filter.filter(undefined)).toBe(undefined)
    expect(filter.filter(true)).toBe(true)
  })

  it('should handle complex HTML structures', () => {
    const html = `
      <div class="wrapper">
        <h1>Title</h1>
        <p>First paragraph</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    `
    const result = filter.filter(html)
    expect(result).toBe('Title First paragraph Item 1 Item 2')
  })

  it('should handle script and style tags', () => {
    const result = filter.filter(
      '<p>Text</p><script>alert("test")</script><style>.test{}</style>'
    )
    expect(result).toBe('Text alert("test") .test{}')
  })

  describe('unclosed and malformed tags', () => {
    it.each([
      ['<scr<script>ipt>alert(1)', [], 'ipt>alert(1)'],
      ['a<b<c>d', [], 'a d'],
      ['<>', [], '<>'],
      ['x</', [], 'x</'],
      ['a < b > c', [], 'a < b > c'],
      ['&lt;script&gt;alert(1)&lt;/script&gt;', [], 'alert(1)'],
      ['<p>Hi</p> tail <b', [], 'Hi tail <b'],
      ['<b>bold</b> <i>it</i>', ['b'], '<b>bold</b> it'],
      ['<a href="javascript:x" onclick="y">l</a> <', ['a'], '<a>l</a> <'],
      ['<b <b <b>x', ['b'], '<b b b>x'],
      ['no tags at all >', [], 'no tags at all >'],
      ['<<<>>>', [], '>>'],
      ['a>b<c', ['b'], 'a>b<c'],
    ])(
      'should filter %j with allowTags %j to %j',
      (input, allowTags, expected) => {
        expect(filter.filter(input, { allowTags })).toBe(expected)
      }
    )

    it('should leave text after the last > untouched', () => {
      expect(filter.filter('<p>Hi</p> a < b <c')).toBe('Hi a < b <c')
    })
  })

  describe('linear-time behaviour', () => {
    const size = 200000
    const limitMs = 1000

    const timeIt = (input: string, allowTags: string[]) => {
      const start = Date.now()
      filter.filter(input, { allowTags })
      return Date.now() - start
    }

    it.each([
      ['only <', '<'.repeat(size), []],
      ['<a repeated with no >', '<a'.repeat(size / 2), []],
      ['a > followed by only <', '>' + '<'.repeat(size), []],
      [
        'an allow-listed tag opener repeated with no >',
        '<b '.repeat(size / 2),
        ['b'],
      ],
    ])('should not take quadratic time on %s', (_label, input, allowTags) => {
      expect(timeIt(input, allowTags)).toBeLessThan(limitMs)
    })
  })
})
