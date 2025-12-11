import Schema from 'schema'

describe('validatePaths', () => {
  it('should process field name', async () => {
    const paths = { age: '35' }

    const schema = new Schema({
      age: Number,
    })

    await schema.validatePaths(paths)

    expect(paths.age).toBe(35)
    expect(paths.age.constructor).toBe(Number)
  })

  it('should process field path', async () => {
    const paths = { 'name.first': 12345 }

    const schema = new Schema({
      name: { first: String },
    })

    await schema.validatePaths(paths)

    expect(paths['name.first']).toBe('12345')
    expect(paths['name.first'].constructor).toBe(String)
  })

  it('should process field path array element', async () => {
    const paths = {
      'names.0.first': 1234,
    }

    const schema = new Schema({
      names: [{ first: String }],
    })

    await schema.validatePaths(paths)

    expect(paths['names.0.first']).toBe('1234')
    expect(paths['names.0.first'].constructor).toBe(String)
  })

  it('should process field path array', async () => {
    const paths = {
      'names.*.first': 1234,
    }

    const schema = new Schema({
      names: [{ first: String }],
    })

    await schema.validatePaths(paths)

    expect(paths['names.*.first']).toBe('1234')
    expect(paths['names.*.first'].constructor).toBe(String)
  })

  it('should apply filters for dot-notation keys matching wildcard schema', async () => {
    const schema = new Schema({
      title: {
        '*': {
          $type: String,
          $filter: { trim: true },
        },
      },
    })

    const paths = { 'title.eng': '  value  ' }
    await schema.validatePaths(paths)

    expect(paths['title.eng']).toBe('value')
  })

  it('should apply type casting for dot-notation keys matching wildcard schema', async () => {
    const schema = new Schema({
      count: {
        '*': Number,
      },
    })

    const paths = { 'count.total': '42' }
    await schema.validatePaths(paths)

    expect(paths['count.total']).toBe(42)
    expect(paths['count.total'].constructor).toBe(Number)
  })

  it('should apply validators for dot-notation keys matching wildcard schema', async () => {
    const schema = new Schema({
      data: {
        '*': {
          $type: String,
          $validate: { notEmpty: true },
        },
      },
    })

    const paths = { 'data.key': '' }
    const result = await schema.validatePaths(paths)

    expect(result.isValid).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('should skip validation for null $nullable object', async () => {
    const schema1 = new Schema({
      user: {
        name: String,
        address: {
          street: { $type: String, $validate: { required: true } },
        },
      },
    })
    const resultFail = await schema1.validatePaths({
      user: {
        name: 'Kevin',
        address: null, // missing required "street"
      },
    })
    expect(resultFail.isValid).toBe(false)

    const data = {
      user: {
        name: 'Kevin',
        address: null,
      },
    }

    const schema2 = new Schema({
      user: {
        name: String,
        address: {
          $nullable: true,
          street: { $validate: { required: true } },
        },
      },
    })

    const result = await schema2.validatePaths(data)
    expect(result.isValid).toBe(true)
    expect(data.user.address).toBeNull()
  })

  it('should skip validation for null $nullable within array', async () => {
    const schema1 = new Schema({
      user: {
        name: String,
        business: {
          $type: Array,
          $spec: {
            businessId: { $type: String },
            invite: {
              userId: { $type: String, $validate: { required: true } },
            },
          },
        },
      },
    })
    const resultFail = await schema1.validatePaths({
      user: {
        name: 'Kevin',
        business: [
          {
            businessId: '1',
            invite: null, // missing "userId" - not nullable
          },
        ],
      },
    })
    expect(resultFail.isValid).toBe(false)

    const data = {
      user: {
        name: 'Kevin',
        business: [
          {
            businessId: '1',
            invite: null,
          },
        ],
      },
    }

    const schema2 = new Schema({
      user: {
        name: String,
        business: {
          $type: Array,
          $spec: {
            businessId: { $type: String },
            invite: {
              $nullable: true,
              userId: { $type: String, $validate: { required: true } },
              created: { $type: Date, $validate: { required: true } },
            },
          },
        },
      },
    })

    const result = await schema2.validatePaths(data)
    expect(result.isValid).toBe(true)
    expect(data.user.business[0].invite).toBeNull()
  })
})
