import Schema from 'schema'

describe('validator - $nullable', () => {
  it('should skip validation for null $nullable within array', async () => {
    const schema = new Schema({
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
    const resultFail = await schema.validate({
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

    const schemaWithNullable = new Schema({
      user: {
        name: String,
        business: {
          $type: Array,
          $spec: {
            businessId: { $type: String },
            invite: {
              $nullable: true,
              userId: { $type: String, $validate: { required: true } },
            },
          },
        },
      },
    })

    const result = await schemaWithNullable.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.user.business[0].invite).toBeNull()
  })

  it('should skip validation for null $nullable object', async () => {
    const schema = new Schema({
      user: {
        name: String,
        address: {
          street: { $type: String, $validate: { required: true } },
        },
      },
    })
    const resultFail = await schema.validate({
      user: {
        name: 'Kevin',
        address: null, // missing required "street" - not nullable
      },
    })
    expect(resultFail.isValid).toBe(false)

    const data = {
      user: {
        name: 'Kevin',
        address: null,
      },
    }

    const schemaWithNullable = new Schema({
      user: {
        name: String,
        address: {
          $nullable: true,
          street: { $validate: { required: true } },
        },
      },
    })

    const result = await schemaWithNullable.validate(data)
    expect(result.isValid).toBe(true)
    expect(data.user.address).toBeNull()
  })
})
