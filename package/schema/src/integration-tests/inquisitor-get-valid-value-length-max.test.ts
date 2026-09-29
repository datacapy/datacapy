import Schema from 'schema'

describe('getValidValueLengthMax', () => {
  it('should return max length for path', async () => {
    const schema = new Schema({
      model: {
        $type: Array,
        $validate: {
          valueLength: { max: 3 },
        },
      },
    })
    const validValues = schema.getInquisitor().getValidValueLengthMax('model')
    expect(validValues).toBe(3)
  })

  it('should return max length for array path', async () => {
    const schema = new Schema({
      model: [
        {
          synth: {
            $type: Array,
            $validate: {
              valueLength: { max: 9 },
            },
          },
        },
      ],
    })
    const validValues = schema
      .getInquisitor()
      .getValidValueLengthMax('model.*.synth')
    expect(validValues).toBe(9)
  })

  it('should return max length for deep path', async () => {
    const schema = new Schema({
      model: {
        synth: {
          bestSeller: {
            $type: Array,
            $validate: {
              valueLength: { max: 18 },
            },
          },
        },
      },
    })
    const validValues = schema
      .getInquisitor()
      .getValidValueLengthMax('model.synth.bestSeller')
    expect(validValues).toBe(18)
  })
})
