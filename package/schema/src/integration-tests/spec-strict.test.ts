import Schema from 'schema'

/**
 * Bug report reproduction test
 * Issue: $spec nested fields not recognized during validation when parent object has value
 *
 * When using $spec to define a nullable object with nested fields, the validator
 * fails to recognize the nested field definitions, returning "Field not specified" errors.
 */
describe('Bug: $spec nested fields with strict mode', () => {
  it('should validate nested fields inside $spec when parent object has a value', async () => {
    const schema = new Schema({
      $name: 'surveyResponse',
      $strict: true,
      _id: {
        $type: String,
      },
      merge: {
        $type: Object,
        $nullable: true,
        $filter: { defaultValue: null },
        $spec: {
          fromSnapshotId: {
            $type: String,
          },
          fromResponseId: {
            $type: String,
          },
          at: {
            $type: Date,
          },
        },
      },
    })

    // Test with non-null merge object
    const data = {
      _id: 'response123',
      merge: {
        fromSnapshotId: '31pAurjXaGfSkC47KMj1X',
        fromResponseId: '31pIMCSThA2Y5dfpepp1X',
        at: new Date('2025-12-10T11:02:19.948Z'),
      },
    }

    const result = await schema.validate(data)

    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('should allow null value for nullable object with $spec', async () => {
    const schema = new Schema({
      $strict: true,
      _id: {
        $type: String,
      },
      merge: {
        $type: Object,
        $nullable: true,
        $filter: { defaultValue: null },
        $spec: {
          fromSnapshotId: {
            $type: String,
          },
          fromResponseId: {
            $type: String,
          },
          at: {
            $type: Date,
          },
        },
      },
    })

    // Test with null merge object
    const data = {
      _id: 'response123',
      merge: null,
    }

    const result = await schema.validate(data)

    expect(result.isValid).toBe(true)
    expect(data.merge).toBeNull()
  })

  it('should reject invalid nested fields inside $spec', async () => {
    const schema = new Schema({
      $strict: true,
      _id: {
        $type: String,
      },
      merge: {
        $type: Object,
        $nullable: true,
        $filter: { defaultValue: null },
        $spec: {
          fromSnapshotId: {
            $type: String,
          },
        },
      },
    })

    // Test with extra field not in $spec (should fail in strict mode)
    const data = {
      _id: 'response123',
      merge: {
        fromSnapshotId: 'abc123',
        invalidField: 'should fail',
      },
    }

    const result = await schema.validate(data)

    expect(result.isValid).toBe(false)
    // Error path is just 'invalidField' not 'merge.invalidField' because
    // the iterator descends into the merge object before checking strict mode
    expect(result.errors).toHaveProperty('invalidField')
  })
})
