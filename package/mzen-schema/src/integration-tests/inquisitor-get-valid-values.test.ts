import Schema from 'schema'

describe('getValidValues', () => {
  it('should return array of valid inArray validate values for path', async () => {
    const schema = new Schema({
      model: {
        $type: Array,
        $validate: {
          inArray: { values: ['A', 'B', 'C'] },
        },
      },
    })
    const validValues = schema.getInquisitor().getValidValues('model')
    expect(validValues).toEqual(['A', 'B', 'C'])
  })

  it('should return array of valid inArray validate values for array path', async () => {
    const schema = new Schema({
      model: [
        {
          synth: {
            $type: Array,
            $validate: {
              inArray: { values: ['A', 'B', 'C'] },
            },
          },
        },
      ],
    })
    const validValues = schema.getInquisitor().getValidValues('model.*.synth')
    expect(validValues).toEqual(['A', 'B', 'C'])
  })

  it('should return array of valid inArray validate values for deep path', async () => {
    const schema = new Schema({
      model: {
        synth: {
          bestSeller: {
            $type: Array,
            $validate: {
              inArray: { values: ['A', 'B', 'C'] },
            },
          },
        },
      },
    })
    const validValues = schema
      .getInquisitor()
      .getValidValues('model.synth.bestSeller')
    expect(validValues).toEqual(['A', 'B', 'C'])
  })
})
