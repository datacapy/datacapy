import SchemaUtil from 'utility'

describe('SchemaUtil', () => {
  describe('getSpec()', () => {
    it('should return spec', () => {
      const spec = {
        house: {
          rooms: [
            {
              name: String,
              sleepHere: Boolean,
            },
          ],
        },
      }

      const result = SchemaUtil.getSpec('', spec)
      expect(result).toEqual(spec)
    })

    it('should return fields config for path field', () => {
      const spec = {
        house: {
          rooms: [
            [
              {
                name: String,
                sleepHere: Boolean,
              },
            ],
          ],
        },
      }

      const result = SchemaUtil.getSpec('house', spec)
      expect(result).toEqual(spec.house)
    })

    it('should return fields config for path deep field', () => {
      const spec = {
        house: {
          rooms: [
            [
              {
                name: String,
                sleepHere: Boolean,
              },
            ],
          ],
        },
      }

      const result = SchemaUtil.getSpec('house.rooms', spec)
      expect(result).toEqual(spec.house.rooms)
    })

    it('should return fields config for path deep array', () => {
      const spec = {
        house: {
          rooms: [
            [
              {
                name: String,
                sleepHere: Boolean,
              },
            ],
          ],
        },
      }

      const result = SchemaUtil.getSpec('house.rooms.*.*', spec)
      expect(result).toEqual(spec.house.rooms[0][0])
    })

    it('should return fields config for path deep array using array index path', () => {
      const spec = {
        house: {
          rooms: [
            [
              {
                name: String,
                sleepHere: Boolean,
              },
            ],
          ],
        },
      }

      const result = SchemaUtil.getSpec('house.rooms.0.1', spec)
      expect(result).toEqual(spec.house.rooms[0][0])
    })

    it('should return fields config for path deep array using array index path for array defined with object descriptor', () => {
      const spec = {
        house: {
          rooms: {
            $type: Array,
            $spec: {
              $type: Array,
              $spec: {
                name: String,
                sleepHere: Boolean,
              },
            },
          },
        },
      }

      const result = SchemaUtil.getSpec('house.rooms.0', spec)
      expect(result).toEqual(spec.house.rooms.$spec)
    })

    it('should return fields config for path deep array field', () => {
      const spec = {
        house: {
          rooms: [
            [
              {
                name: String,
                sleepHere: Boolean,
              },
            ],
          ],
        },
      }

      const result = SchemaUtil.getSpec('house.rooms.*.*.name', spec)
      expect(result).toEqual(spec.house.rooms[0][0].name)
    })
  })
})
