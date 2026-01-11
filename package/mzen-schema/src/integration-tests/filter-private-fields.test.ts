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
