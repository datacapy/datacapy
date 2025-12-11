import Schema from 'schema'

describe('filtering', () => {
  describe('trim', () => {
    it('should trim string', async () => {
      const data = { name: ' Kevin ' }

      const schema = new Schema({
        name: { $type: String, $filter: { trim: true } },
      })

      await schema.validate(data)
      expect(data.name).toBe('Kevin')
    })
  })
  describe('uppercase', () => {
    it('should convert string to uppercase', async () => {
      const data = { name: 'kevin' }

      const schema = new Schema({
        name: { $type: String, $filter: { uppercase: true } },
      })

      await schema.validate(data)
      expect(data.name).toBe('KEVIN')
    })
  })
  describe('lowercase', () => {
    it('should convert string to lowercase', async () => {
      const data = { name: 'KEVIN' }

      const schema = new Schema({
        name: { $type: String, $filter: { lowercase: true } },
      })

      await schema.validate(data)
      expect(data.name).toBe('kevin')
    })
  })
  describe('postcode', () => {
    it('should convert string to postcode', async () => {
      let data = { postcode: 'L249HJ' }
      let schema = new Schema({
        postcode: { $type: String, $filter: { postcode: true } },
      })
      await schema.validate(data)
      expect(data.postcode).toBe('L24 9HJ')

      data = { postcode: 'L14LN' }
      schema = new Schema({
        postcode: { $type: String, $filter: { postcode: true } },
      })
      await schema.validate(data)
      expect(data.postcode).toBe('L1 4LN')
    })
  })
  describe('defaultValue', () => {
    it('should set default value when field undefined', async () => {
      const data = { name: undefined }

      const schema = new Schema({
        name: { $type: String, $filter: { defaultValue: 'Kevin' } },
      })

      await schema.validate(data)
      expect(data.name).toBe('Kevin')
    })
  })
  describe('custom', () => {
    it('should filter via provided filter callback', async () => {
      const data = { name: 'Kevin' }

      const schema = new Schema({
        name: {
          $type: String,
          $filter: {
            custom: (value) => {
              return value + ' modified'
            },
          },
        },
      })

      await schema.validate(data)
      expect(data.name).toBe('Kevin modified')
    })
  })
  describe('stripHtml', () => {
    it('should strip HTML tags from string', async () => {
      const data = { content: '<p>This is <strong>bold</strong> text.</p>' }

      const schema = new Schema({
        content: { $type: String, $filter: { stripHtml: true } },
      })

      await schema.validate(data)
      expect(data.content).toBe('This is bold text.')
    })

    it('should keep allowed tags', async () => {
      const data = {
        content:
          '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>',
      }

      const schema = new Schema({
        content: {
          $type: String,
          $filter: {
            stripHtml: {
              allowTags: ['strong'],
            },
          },
        },
      })

      await schema.validate(data)
      expect(data.content).toBe(
        'This is <strong>bold</strong> and italic text.'
      )
    })

    it('should decode HTML entities', async () => {
      const data = { content: '&lt;p&gt;This &amp; that&lt;/p&gt;' }

      const schema = new Schema({
        content: { $type: String, $filter: { stripHtml: true } },
      })

      await schema.validate(data)
      expect(data.content).toBe('This & that')
    })

    it('should handle complex HTML', async () => {
      const data = {
        content:
          '<div class="wrapper"><h1>Title</h1><p>Paragraph with <a href="http://example.com">link</a></p></div>',
      }

      const schema = new Schema({
        content: { $type: String, $filter: { stripHtml: true } },
      })

      await schema.validate(data)
      expect(data.content).toBe('Title Paragraph with link')
    })
  })
})
