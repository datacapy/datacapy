import Schema from 'schema'

describe('getValidValueLengthMin', () => {
  it('should return min length for path', async () => {
    const schema = new Schema({
      model: {
        $type: Array,
        $validate: {
          valueLength: { min: 3 },
        },
      },
    })
    const validValues = schema.getInquisitor().getValidValueLengthMin('model')
    expect(validValues).toBe(3)
  })

  it('should return min length for array path', async () => {
    const schema = new Schema({
      model: [
        {
          synth: {
            $type: Array,
            $validate: {
              valueLength: { min: 9 },
            },
          },
        },
      ],
    })
    const validValues = schema
      .getInquisitor()
      .getValidValueLengthMin('model.*.synth')
    expect(validValues).toBe(9)
  })

  it('should return min length for deep path', async () => {
    const schema = new Schema({
      model: {
        synth: {
          bestSeller: {
            $type: Array,
            $validate: {
              valueLength: { min: 18 },
            },
          },
        },
      },
    })
    const validValues = schema
      .getInquisitor()
      .getValidValueLengthMin('model.synth.bestSeller')
    expect(validValues).toBe(18)
  })
})
