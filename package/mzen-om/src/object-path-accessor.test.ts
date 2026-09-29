import { ObjectPathAccessor } from '@datacapy/schema'

describe('ObjectPathAccessor', () => {
  describe('pathsMatch()', () => {
    it('should return true if two paths are exactly equal', () => {
      expect(ObjectPathAccessor.pathsMatch('planet', 'planet')).toBe(true)
      expect(
        ObjectPathAccessor.pathsMatch('planet.country', 'planet.country')
      ).toBe(true)
      expect(
        ObjectPathAccessor.pathsMatch(
          'planet.country.city',
          'planet.country.city'
        )
      ).toBe(true)
    })
    it('should accept wildcard in first path argument', () => {
      expect(ObjectPathAccessor.pathsMatch('*', 'planet')).toBe(true)
      expect(ObjectPathAccessor.pathsMatch('planet.*', 'planet.country')).toBe(
        true
      )
      expect(
        ObjectPathAccessor.pathsMatch('planet.*.city', 'planet.country.city')
      ).toBe(true)
    })
    it('should treat wildcard in second path argument as a literal', () => {
      expect(ObjectPathAccessor.pathsMatch('*', '*')).toBe(true)
      expect(ObjectPathAccessor.pathsMatch('planet.country', 'planet.*')).toBe(
        false
      )
      expect(
        ObjectPathAccessor.pathsMatch('planet.country.city', 'planet.country.*')
      ).toBe(false)
    })
    it('should allow wildcard to be escaped with backslash', () => {
      expect(ObjectPathAccessor.pathsMatch('*', '*')).toBe(true)
      expect(ObjectPathAccessor.pathsMatch('planet.*', 'planet.*')).toBe(true)
      expect(
        ObjectPathAccessor.pathsMatch('planet.*.city', 'planet.*.city')
      ).toBe(true)
    })
  })
  describe('getPath()', () => {
    it('should return value at given path', () => {
      const data = {
        planet: 'Earth',
      }

      const result = ObjectPathAccessor.getPath('planet', data)

      expect(result).toBe('Earth')
    })
    it('should return value at given deep path', () => {
      const data = {
        planet: {
          name: 'Earth',
          continent: {
            name: 'Europe',
            country: {
              name: 'UK',
              city: {
                name: 'London',
              },
            },
          },
        },
      }

      const result = ObjectPathAccessor.getPath(
        'planet.continent.country',
        data
      )

      expect(result).toEqual({ name: 'UK', city: { name: 'London' } })
    })
    it('should return value at given array index', () => {
      const data = ['Earth', 'Mars', 'Venus']

      const result = ObjectPathAccessor.getPath('1', data)

      expect(result).toBe('Mars')
    })
    it('should return value at given deep array index', () => {
      const data = [['Earth', 'Mars'], ['Venus']]

      const result = ObjectPathAccessor.getPath('0.1', data)

      expect(result).toBe('Mars')
    })
    it('should return value at given array path', () => {
      const data = [
        {
          planet: {
            name: 'Earth',
            continent: {
              name: 'Europe',
              country: {
                name: 'UK',
                city: {
                  name: 'London',
                },
              },
            },
          },
        },
      ]

      const result = ObjectPathAccessor.getPath(
        '0.planet.continent.country',
        data
      )

      expect(result).toEqual({ name: 'UK', city: { name: 'London' } })
    })
    it('should return array of values for wildcard path', () => {
      const data = {
        planet: {
          one: { name: 'Earth' },
          two: { name: 'Mars' },
          other: { name: 'Venus' },
        },
      }

      const result = ObjectPathAccessor.getPath('planet.*', data)

      expect(result).toEqual([
        { name: 'Earth' },
        { name: 'Mars' },
        { name: 'Venus' },
      ])
    })
    it('should return array of values for wildcard array path', () => {
      const data = {
        planet: [{ name: 'Earth' }, { name: 'Mars' }, { name: 'Venus' }],
        other: [{ name: 'No' }, { name: 'NoNo' }, { name: 'NoNoNo' }],
      }

      const result = ObjectPathAccessor.getPath('planet.*', data)

      expect(result).toEqual([
        { name: 'Earth' },
        { name: 'Mars' },
        { name: 'Venus' },
      ])
    })
    it('should return array of values for multiple wildcard path', () => {
      const data = {
        planet: {
          a: { one: { name: 'Earth' } },
          b: { two: { name: 'Mars' } },
          c: { three: { name: 'Venus' } },
        },
      }

      const result = ObjectPathAccessor.getPath('planet.*.*', data)

      expect(result).toEqual([
        { name: 'Earth' },
        { name: 'Mars' },
        { name: 'Venus' },
      ])
    })
    it('should return array of values for multiple wildcard array path', () => {
      const data = {
        planet: [[{ name: 'Earth' }], [{ name: 'Mars' }], [{ name: 'Venus' }]],
        other: [[{ name: 'No' }], [{ name: 'NoNo' }], [{ name: 'NoNoNo' }]],
      }

      const result = ObjectPathAccessor.getPath('planet.*.*', data)

      expect(result).toEqual([
        { name: 'Earth' },
        { name: 'Mars' },
        { name: 'Venus' },
      ])
    })
  })
  describe('unsetPath()', () => {
    it('should unset value at given path', () => {
      const data = {
        planet: 'Earth',
      }

      ObjectPathAccessor.unsetPath('planet', data)

      expect(data).toEqual({})
      expect(data.planet).toBeUndefined()
    })
    it('should unset value at given deep path', () => {
      const data = {
        planet: {
          name: 'Earth',
          continent: {
            name: 'Europe',
            country: {
              name: 'UK',
              city: {
                name: 'London',
              },
            },
          },
        },
      }

      ObjectPathAccessor.unsetPath('planet.continent.country', data)

      expect(data).toEqual({
        planet: {
          name: 'Earth',
          continent: {
            name: 'Europe',
          },
        },
      })
      expect(data.planet.continent.country).toBeUndefined()
    })
    it('should unset value at given array path', () => {
      const data = [
        {
          planet: {
            name: 'Earth',
            continent: {
              name: 'Europe',
              country: {
                name: 'UK',
                city: {
                  name: 'London',
                },
              },
            },
          },
        },
      ]

      ObjectPathAccessor.unsetPath('0.planet.continent.country', data)

      expect(data).toEqual([
        {
          planet: {
            name: 'Earth',
            continent: {
              name: 'Europe',
            },
          },
        },
      ])
      expect(data[0].planet.continent.country).toBeUndefined()
    })
  })
  describe('setPath()', () => {
    it('should set value at given path', () => {
      const data = {
        planet: 'Earth',
      }

      const result = ObjectPathAccessor.setPath('planet', 'Mars', data)

      expect(result).toBe('Mars')
      expect(data.planet).toBe('Mars')
    })
    it('should set value at given deep path', () => {
      const data = {
        planet: {
          name: 'Earth',
          continent: {
            name: 'Europe',
            country: {
              name: 'UK',
              city: {
                name: 'London',
              },
            },
          },
        },
      }

      const result = ObjectPathAccessor.setPath(
        'planet.continent.country.city',
        { name: 'Liverpool' },
        data
      )

      expect(result).toEqual({ name: 'Liverpool' })
      expect(data.planet.continent.country.city).toEqual({ name: 'Liverpool' })
    })
    it('should set value at given array index', () => {
      const data = ['Earth', 'Mars', 'Venus']

      const result = ObjectPathAccessor.setPath('1', 'neptune', data)

      expect(result).toBe('neptune')
      expect(data[1]).toBe('neptune')
    })
    it('should set value at given deep array index', () => {
      const data = [['Earth', 'Mars'], ['Venus']]

      const result = ObjectPathAccessor.setPath('0.1', 'neptune', data)

      expect(result).toBe('neptune')
      expect(data[0][1]).toBe('neptune')
    })
    it('should set value at given array path', () => {
      const data = [
        {
          planet: {
            name: 'Earth',
            continent: {
              name: 'Europe',
              country: {
                name: 'UK',
                city: {
                  name: 'London',
                },
              },
            },
          },
        },
      ]

      const result = ObjectPathAccessor.setPath(
        '0.planet.continent.country.city',
        { name: 'Liverpool' },
        data
      )

      expect(result).toEqual({ name: 'Liverpool' })
      expect(data[0].planet.continent.country.city).toEqual({
        name: 'Liverpool',
      })
    })
    it('should set value to array for wildcard path', () => {
      const data = {
        planet: {
          one: { name: 'Earth' },
          two: { name: 'Mars' },
          other: { name: 'Venus' },
        },
      }

      const result = ObjectPathAccessor.setPath(
        'planet.*',
        { name: 'Pluto' },
        data
      )

      expect(result).toEqual([
        { name: 'Pluto' },
        { name: 'Pluto' },
        { name: 'Pluto' },
      ])
      expect(data.planet.one).toEqual({ name: 'Pluto' })
      expect(data.planet.two).toEqual({ name: 'Pluto' })
      expect(data.planet.other).toEqual({ name: 'Pluto' })
    })
    it('should set value to array for multiple wildcard path', () => {
      const data = {
        planet: {
          a: { one: { name: 'Earth' } },
          b: { two: { name: 'Mars' } },
          c: { three: { name: 'Venus' } },
        },
      }

      const result = ObjectPathAccessor.setPath(
        'planet.*.*',
        { name: 'Pluto' },
        data
      )

      expect(result).toEqual([
        { name: 'Pluto' },
        { name: 'Pluto' },
        { name: 'Pluto' },
      ])
      expect(data.planet.a.one).toEqual({ name: 'Pluto' })
      expect(data.planet.b.two).toEqual({ name: 'Pluto' })
      expect(data.planet.c.three).toEqual({ name: 'Pluto' })
    })
  })
  describe('mutatePath()', () => {
    it('should mutate value at given path', () => {
      const data = {
        planet: 'Earth',
      }

      const result = ObjectPathAccessor.mutatePath(
        'planet',
        data,
        function (value) {
          return value + ' X'
        }
      )

      expect(result).toBe('Earth X')
      expect(data.planet).toBe('Earth X')
    })
    it('should mutate value at given deep path', () => {
      const data = {
        planet: {
          name: 'Earth',
          continent: {
            name: 'Europe',
            country: {
              name: 'UK',
              city: {
                name: 'London',
              },
            },
          },
        },
      }

      const result = ObjectPathAccessor.mutatePath(
        'planet.continent.country.city.name',
        data,
        function (value) {
          return value + ' X'
        }
      )

      expect(result).toBe('London X')
      expect(data.planet.continent.country.city.name).toBe('London X')
    })
    it('should mutate value at given array index', () => {
      const data = ['Earth', 'Mars', 'Venus']

      const result = ObjectPathAccessor.mutatePath('1', data, function (value) {
        value = value + ' X'
        return value
      })

      expect(result).toBe('Mars X')
      expect(data[1]).toBe('Mars X')
    })
    it('should mutate value at given deep array index', () => {
      const data = [['Earth', 'Mars'], ['Venus']]

      const result = ObjectPathAccessor.mutatePath(
        '0.1',
        data,
        function (value) {
          return value + ' X'
        }
      )

      expect(result).toBe('Mars X')
      expect(data[0][1]).toBe('Mars X')
    })
    it('should mutate value at given array path', () => {
      const data = [
        {
          planet: {
            name: 'Earth',
            continent: {
              name: 'Europe',
              country: {
                name: 'UK',
                city: {
                  name: 'London',
                },
              },
            },
          },
        },
      ]

      const result = ObjectPathAccessor.mutatePath(
        '0.planet.continent.country.city.name',
        data,
        function (value) {
          return value + ' X'
        }
      )

      expect(result).toBe('London X')
      expect(data[0].planet.continent.country.city.name).toBe('London X')
    })
    it('should mutate array for wildcard path', () => {
      const data = {
        planet: {
          one: { name: 'Earth' },
          two: { name: 'Mars' },
          other: { name: 'Venus' },
        },
      }

      const result = ObjectPathAccessor.mutatePath(
        'planet.*',
        data,
        function (value) {
          return { name: value.name + ' X' }
        }
      )

      expect(result).toEqual([
        { name: 'Earth X' },
        { name: 'Mars X' },
        { name: 'Venus X' },
      ])
      expect(data.planet.one).toEqual({ name: 'Earth X' })
      expect(data.planet.two).toEqual({ name: 'Mars X' })
      expect(data.planet.other).toEqual({ name: 'Venus X' })
    })
    it('should mutate array for multiple wildcard path', () => {
      const data = {
        planet: {
          a: { one: { name: 'Earth' } },
          b: { two: { name: 'Mars' } },
          c: { three: { name: 'Venus' } },
        },
      }

      const result = ObjectPathAccessor.mutatePath(
        'planet.*.*',
        data,
        function (value) {
          value.name = value.name + ' X'
          return value
        }
      )

      expect(result).toEqual([
        { name: 'Earth X' },
        { name: 'Mars X' },
        { name: 'Venus X' },
      ])
      expect(data.planet.a.one).toEqual({ name: 'Earth X' })
      expect(data.planet.b.two).toEqual({ name: 'Mars X' })
      expect(data.planet.c.three).toEqual({ name: 'Venus X' })
    })
  })
})
