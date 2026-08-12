import Schema from 'schema'

describe('applyFiltersPaths', () => {
  it('should apply a filter to a present top-level field', async () => {
    const paths = { name: '  John  ' }

    const schema = new Schema({
      name: { $type: String, $filter: { trim: true } },
    })

    await schema.applyFiltersPaths(paths)

    expect(paths.name).toBe('John')
  })

  it('should apply a filter to a dotted field path', async () => {
    const paths = { 'name.first': '  John  ' }

    const schema = new Schema({
      name: { first: { $type: String, $filter: { trim: true } } },
    })

    await schema.applyFiltersPaths(paths)

    expect(paths['name.first']).toBe('John')
  })

  it('should apply a conditional filter to a nested object present in the paths', async () => {
    const paths = {
      thankYou: {
        link: { url: 'example.com' },
      },
    }

    const schema = new Schema({
      thankYou: {
        link: {
          url: {
            $type: String,
            $filter: {
              prependHttp: { $if: { $not: { $regex: /^https?:\/\// } } },
            },
          },
        },
      },
    })

    await schema.applyFiltersPaths(paths)

    expect(paths.thankYou.link.url).toBe('http://example.com')
  })

  it('should not apply defaultValue filters for fields absent from the paths object', async () => {
    const paths = { name: 'John' }

    const schema = new Schema({
      name: { $type: String },
      age: { $type: Number, $filter: { defaultValue: 30 } },
    })

    await schema.applyFiltersPaths(paths)

    expect('age' in paths).toBe(false)
  })
})
