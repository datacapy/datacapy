import Schema from 'schema'

describe('validator - relations', () => {
  it('should ignore schema of relations', async () => {
    // An empty field is any falsy value: undefined, null, false, 0, '', [], {}
    const data = { name: [1] }

    const schemaAddress = new Schema({
      $name: 'address',
      street: [{ $type: 'String', $validate: { notNull: true } }],
    })

    const schema = new Schema({
      name: [{ $type: 'Mixed', $validate: { notNull: true } }],
      address: { $schemaRelation: 'address' },
    })
    schema.addSchema(schemaAddress)

    const result = await schema.validate(data)
    expect(result.isValid).toBe(true)
  })
})
