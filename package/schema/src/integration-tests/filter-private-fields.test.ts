import Schema from 'schema'

describe('filterPrivate', () => {
  it('filter private params', () => {
    const data = {
      name: 123,
      age: 35,
    }

    const schema = new Schema({
      name: { $type: String, $filter: { private: true } },
    })

    schema.filterPrivate(data)

    expect(data).toEqual({ age: 35 })
  })

  it('filter private params with mode write', () => {
    const data = {
      name: 123,
      age: 35,
    }

    const schema = new Schema({
      name: { $type: String, $filter: { private: 'write' } },
    })

    schema.filterPrivate(data, 'write')

    expect(data).toEqual({ age: 35 })
  })

  it('filter private params with mode read', () => {
    const data = {
      name: 123,
      age: 35,
    }

    const schema = new Schema({
      name: { $type: String, $filter: { private: 'read' } },
    })

    schema.filterPrivate(data, 'read')

    expect(data).toEqual({ age: 35 })
  })
})

describe('filterPrivate - nested structures', () => {
  it('redacts a private field nested inside a plain object', () => {
    const data = { profile: { secret: 'shh', name: 'Bob' } }

    const schema = new Schema({
      profile: {
        $type: Object,
        $spec: {
          secret: { $type: String, $filter: { private: true } },
          name: { $type: String },
        },
      },
    })

    schema.filterPrivate(data)

    expect(data).toEqual({ profile: { name: 'Bob' } })
  })

  it('redacts a private field nested inside an array of objects', () => {
    const data = {
      items: [
        { secret: 'shh1', name: 'A' },
        { secret: 'shh2', name: 'B' },
      ],
    }

    const schema = new Schema({
      items: {
        $type: Array,
        $spec: {
          secret: { $type: String, $filter: { private: true } },
          name: { $type: String },
        },
      },
    })

    schema.filterPrivate(data)

    expect(data).toEqual({ items: [{ name: 'A' }, { name: 'B' }] })
  })

  it('redacts a private field nested inside an $or alternative', () => {
    const data = { value: { secret: 'shh-or', name: 'C' } }

    const schema = new Schema({
      value: {
        $or: [
          { $type: String },
          {
            $type: Object,
            $spec: {
              secret: { $type: String, $filter: { private: true } },
              name: { $type: String },
            },
          },
        ],
      },
    })

    schema.filterPrivate(data)

    expect(data).toEqual({ value: { name: 'C' } })
  })

  it('does not redact a field across $or alternatives of a different type', () => {
    // The string alternative has no fields to redact, so a string value
    // must pass through untouched.
    const data = { value: 'just a string' }

    const schema = new Schema({
      value: {
        $or: [
          { $type: String },
          {
            $type: Object,
            $spec: {
              secret: { $type: String, $filter: { private: true } },
            },
          },
        ],
      },
    })

    schema.filterPrivate(data)

    expect(data).toEqual({ value: 'just a string' })
  })
})

describe('filterPrivateValue', () => {
  it('filter private params', () => {
    const data = {
      name: 123,
      age: 35,
    }

    const schema = new Schema({
      name: { $type: String, $filter: { privateValue: true } },
    })

    schema.filterPrivate(data)

    expect(data).toEqual({ name: true, age: 35 })
  })

  it('filter private params with mode write', () => {
    const data = {
      name: 123,
      age: 35,
    }

    const schema = new Schema({
      name: { $type: String, $filter: { privateValue: 'write' } },
    })

    schema.filterPrivate(data, 'write')

    expect(data).toEqual({ name: true, age: 35 })
  })

  it('filter private params with mode read', () => {
    const data = {
      name: 123,
      age: 35,
    }

    const schema = new Schema({
      name: { $type: String, $filter: { privateValue: 'read' } },
    })

    schema.filterPrivate(data, 'read')

    expect(data).toEqual({ name: true, age: 35 })
  })
})
