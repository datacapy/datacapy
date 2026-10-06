import ObjectPathAccessor from './object-path-accessor'

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
      expect(ObjectPathAccessor.pathsMatch('\*', '*')).toBe(true)
      expect(ObjectPathAccessor.pathsMatch('planet.\*', 'planet.*')).toBe(true)
      expect(
        ObjectPathAccessor.pathsMatch('planet.\*.city', 'planet.*.city')
      ).toBe(true)
    })
  })
  describe('getPath()', () => {
    it('should return value at given path', () => {
      const data = {
        planet: 'Earth',
      }

      const result = ObjectPathAccessor.getPath('planet', data)

      expect(result).toEqual('Earth')
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
    it('should return values within array using mongodb style path (no wildcards)', () => {
      const data = {
        planet: [{ name: 'Earth' }, { name: 'Mars' }],
      }

      const result = ObjectPathAccessor.getPath('planet.name', data)

      expect(result).toEqual(['Earth', 'Mars'])
    })
    it('should return values within deep array using mongodb style path (no wildcards)', () => {
      const data = {
        planets: [
          {
            name: 'Earth',
            countries: [{ name: 'USA' }, { name: 'UK' }],
          },
          {
            name: 'Mars',
            countries: [{ name: 'Zon' }, { name: 'Spla' }],
          },
        ],
      }

      const result = ObjectPathAccessor.getPath('planets.countries.name', data)

      expect(result).toEqual(['USA', 'UK', 'Zon', 'Spla'])
    })
    it('should return value at given array index', () => {
      const data = ['Earth', 'Mars', 'Venus']

      const result = ObjectPathAccessor.getPath('1', data)

      expect(result).toEqual('Mars')
    })
    it('should return value at given deep array index', () => {
      const data = [['Earth', 'Mars'], ['Venus']]

      const result = ObjectPathAccessor.getPath('0.1', data)

      expect(result).toEqual('Mars')
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
  describe('setPath()', () => {
    it('should set value at given path', () => {
      const data = {
        planet: 'Earth',
      }

      const result = ObjectPathAccessor.setPath('planet', 'Mars', data)

      expect(result).toEqual('Mars')
      expect(data.planet).toEqual('Mars')
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
    it('should set a new property on existing object', () => {
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
      } as any

      const result = ObjectPathAccessor.setPath(
        'planet.continent.country.city.population',
        8900000,
        data
      )

      expect(result).toBe(8900000)
      expect(data.planet.continent.country.city.population).toBe(8900000)
    })
    it('should create nested objects when setting a deep path', () => {
      const data = { planet: {} } as any

      ObjectPathAccessor.setPath(
        'planet.continent.country.city',
        'London',
        data
      )

      expect(data.planet.continent.country.city).toBe('London')
      expect(data).toEqual({
        planet: {
          continent: {
            country: {
              city: 'London',
            },
          },
        },
      })
    })
    it('should set a value in an array using an index', () => {
      const data = {
        planets: ['Mercury', 'Venus', 'Earth'],
      }

      ObjectPathAccessor.setPath('planets.1', 'Mars', data)

      expect(data.planets[1]).toBe('Mars')
      expect(data.planets).toEqual(['Mercury', 'Mars', 'Earth'])
    })
    it('should set value at given array index', () => {
      const data = ['Earth', 'Mars', 'Venus']

      const result = ObjectPathAccessor.setPath('1', 'neptune', data)

      expect(result).toEqual('neptune')
      expect(data[1]).toEqual('neptune')
    })
    it('should set value at given deep array index', () => {
      const data = [['Earth', 'Mars'], ['Venus']]

      const result = ObjectPathAccessor.setPath('0.1', 'neptune', data)

      expect(result).toEqual('neptune')
      expect(data[0][1]).toEqual('neptune')
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
    it('should create an array if setting a numeric path on a non-existent property', () => {
      const data = {} as any

      ObjectPathAccessor.setPath('newArray.0', 'First Item', data)

      expect(Array.isArray(data.newArray)).toBe(true)
      expect(data.newArray[0]).toBe('First Item')
    })
    it('should handle mixed object and array paths', () => {
      const data = {
        solar_system: {
          stars: ['Sun'],
        },
      } as any

      ObjectPathAccessor.setPath('solar_system.planets.0.name', 'Earth', data)

      expect(data.solar_system.planets[0].name).toBe('Earth')
      expect(data).toEqual({
        solar_system: {
          stars: ['Sun'],
          planets: [{ name: 'Earth' }],
        },
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
    it('should splice array elements', () => {
      const data = ['a', 'b', 'c', 'd', 'e']

      ObjectPathAccessor.unsetPath(2, data)

      expect(data).toEqual(['a', 'b', 'd', 'e'])
    })
    it('should not create intermediate paths that do not exist', () => {
      const data = [{ lastResponseAt: new Date() }]

      ObjectPathAccessor.unsetPath('*.messages.*.user', data)

      expect((data[0] as any).messages).toBeUndefined()
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
        (value) => value + ' X'
      )

      expect(result).toEqual('Earth X')
      expect(data.planet).toEqual('Earth X')
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
        (value) => value + ' X'
      )

      expect(result).toEqual('London X')
      expect(data.planet.continent.country.city.name).toEqual('London X')
    })
    it('should mutate value at given array index', () => {
      const data = ['Earth', 'Mars', 'Venus']

      const result = ObjectPathAccessor.mutatePath('1', data, (value) => {
        value = value + ' X'
        return value
      })

      expect(result).toEqual('Mars X')
      expect(data[1]).toEqual('Mars X')
    })
    it('should mutate value at given deep array index', () => {
      const data = [['Earth', 'Mars'], ['Venus']]

      const result = ObjectPathAccessor.mutatePath('0.1', data, (value) => {
        return value + ' X'
      })

      expect(result).toEqual('Mars X')
      expect(data[0][1]).toEqual('Mars X')
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
        (value) => {
          return value + ' X'
        }
      )

      expect(result).toEqual('London X')
      expect(data[0].planet.continent.country.city.name).toEqual('London X')
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
        (value) => {
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
        (value) => {
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

  describe('prototype pollution', () => {
    afterEach(() => {
      delete (Object.prototype as Record<string, unknown>).polluted
    })

    const unsafePaths = [
      '__proto__.polluted',
      'constructor.prototype.polluted',
      'a.__proto__.polluted',
      '*.__proto__.polluted',
    ]

    it.each(unsafePaths)('setPath ignores %s', (path) => {
      ObjectPathAccessor.setPath(path, true, { a: {}, b: {} })
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
      expect(Object.prototype).not.toHaveProperty('polluted')
    })

    it.each(unsafePaths)('mutatePath ignores %s', (path) => {
      ObjectPathAccessor.mutatePath(path, { a: {}, b: {} }, () => true)
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it.each(unsafePaths)('unsetPath ignores %s', (path) => {
      ObjectPathAccessor.unsetPath(path, { a: {}, b: {} })
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('does not traverse inherited members', () => {
      expect(ObjectPathAccessor.getPath('toString', {})).toBeUndefined()
    })

    it('still sets ordinary nested paths', () => {
      const data = { a: {} } as Record<string, any>
      ObjectPathAccessor.setPath('a.b.c', 1, data)
      expect(data.a.b.c).toBe(1)
    })
  })
})
