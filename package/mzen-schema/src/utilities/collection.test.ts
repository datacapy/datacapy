import clone from 'clone'
import { Collection } from './collection'
import ObjectId from 'bson-objectid'

class People extends Collection<any> {}

const data = {
  people: [
    {
      _id: new ObjectId('5932fce4aa1fe86c751fce30'),
      name: 'Kevin',
      age: 37,
      nationality: 'British',
      address: { postcode: 'L15' },
    },
    {
      _id: new ObjectId('5932fce4aa1fe86c751fce31'),
      name: 'Fudge',
      age: 8,
      nationality: 'British',
      address: { postcode: 'L15' },
    },
    {
      _id: new ObjectId('5932fce4aa1fe86c751fce32'),
      name: 'Kar Chun',
      age: 37,
      nationality: 'Malaysian',
      address: { postcode: '87MF' },
    },
    {
      _id: new ObjectId('5932fce4aa1fe86c751fce33'),
      name: 'Alison',
      age: 37,
      nationality: 'British',
      address: { postcode: 'L1' },
    },
  ],
}

describe('Collection', () => {
  describe('findAll()', () => {
    it('should return array of objects matching query', () => {
      const people = new Collection(...data.people)
      const result = people.findAll({ nationality: 'British' })
      expect(result.length).toBe(3)
      expect(result[0].name).toBe('Kevin')
      expect(result[1].name).toBe('Fudge')
      expect(result[2].name).toBe('Alison')
    })

    it('should return array of objects matching query using dotted paths', () => {
      const people = new Collection(...data.people)
      const result = people.findAll({ 'address.postcode': 'L15' })
      expect(result.length).toBe(2)
      expect(result[0].name).toBe('Kevin')
      expect(result[1].name).toBe('Fudge')
    })

    it('should return an empty array if nothing found', () => {
      const people = new Collection()
      const result = people.findAll({ nationality: 'Other' })
      expect(result.length).toBe(0)
    })

    it('should return array of objects matching bson object id string', () => {
      const people = new People(...data.people)

      const resultFail = people.findAll({
        _id: new ObjectId('5932fce4aa1fe86c751fce30'),
      })
      expect(resultFail.length).toBe(0)

      const resultA = people.findAll({
        _id: String(new ObjectId('5932fce4aa1fe86c751fce30')),
      })
      expect(resultA.length).toBe(1)
      expect(resultA[0].name).toBe('Kevin')

      const resultB = people.findAll({ _id: '5932fce4aa1fe86c751fce30' })
      expect(resultB.length).toBe(1)
      expect(resultB[0].name).toBe('Kevin')
    })
  })

  describe('findOne()', () => {
    it('should return first element matching query', () => {
      const people = new Collection(...data.people)
      const result = people.findOne({ nationality: 'British' })
      expect(result.name).toBe('Kevin')
    })

    it('should return first element matching query using dotted paths', () => {
      const people = new Collection(...data.people)
      const result = people.findOne({ 'address.postcode': 'L15' })
      expect(result.name).toBe('Kevin')
    })

    it('should return undefined nothing found', () => {
      const people = new Collection()
      const result = people.findOne({ nationality: 'Other' })
      expect(result).toBeUndefined()
    })

    it('should return object matching bson object id string', () => {
      const people = new People(...data.people)

      const resultFail = people.findOne({
        _id: new ObjectId('5932fce4aa1fe86c751fce30'),
      })
      expect(resultFail).toBeUndefined()

      const resultA = people.findOne({
        _id: String(new ObjectId('5932fce4aa1fe86c751fce30')),
      })
      expect(resultA.name).toBe('Kevin')

      const resultB = people.findOne({ _id: '5932fce4aa1fe86c751fce30' })
      expect(resultB.name).toBe('Kevin')
    })
  })

  describe('update()', () => {
    describe('$set', () => {
      it('should $set on objects targeted by find query', () => {
        const people = new Collection(...clone(data.people))
        const findResultA = people.findAll({ name: 'Kevin' })
        expect(findResultA[0].name).toBe('Kevin')
        expect(findResultA[0].age).toBe(37)
        people.update(
          { name: 'Kevin' },
          {
            $set: { age: 38 },
          }
        )
        expect(findResultA[0].age).toBe(38)
      })

      it('should $set on objects targeted by find query using dotted path', () => {
        const people = new Collection(...clone(data.people))
        const findResultA = people.findAll({ 'address.postcode': 'L15' })
        expect(findResultA[0].name).toBe('Kevin')
        expect(findResultA[0].age).toBe(37)
        expect(findResultA[1].name).toBe('Fudge')
        expect(findResultA[1].age).toBe(8)
        people.update(
          { 'address.postcode': 'L15' },
          {
            $set: { age: 5 },
          }
        )
        expect(findResultA[0].age).toBe(5)
        expect(findResultA[1].age).toBe(5)
      })

      it('should $set on objects dotted path targeted by find query', () => {
        const people = new Collection(...clone(data.people))
        const findResultA = people.findAll({ name: 'Kevin' })
        expect(findResultA[0].name).toBe('Kevin')
        expect(findResultA[0].address.postcode).toBe('L15')
        people.update(
          { name: 'Kevin' },
          {
            $set: { 'address.postcode': 'L15 1HL' },
          }
        )
        expect(findResultA[0].address.postcode).toBe('L15 1HL')
      })
    })

    describe('$unset', () => {
      it('should $unset on objects targeted by find query', () => {
        const people = new Collection(...clone(data.people))
        const findResultA = people.findAll({ name: 'Kevin' })
        expect(findResultA[0].name).toBe('Kevin')
        expect(findResultA[0].age).toBe(37)
        people.update(
          { name: 'Kevin' },
          {
            $unset: { age: true },
          }
        )
        expect(findResultA[0].age).toBeUndefined()
      })

      it('should $unset on objects targeted by find query using dotted path', () => {
        const people = new Collection(...clone(data.people))
        const findResultA = people.findAll({ 'address.postcode': 'L15' })
        expect(findResultA[0].name).toBe('Kevin')
        expect(findResultA[0].age).toBe(37)
        expect(findResultA[1].name).toBe('Fudge')
        expect(findResultA[1].age).toBe(8)
        people.update(
          { 'address.postcode': 'L15' },
          {
            $unset: { age: true },
          }
        )
        expect(findResultA[0].age).toBeUndefined()
        expect(findResultA[1].age).toBeUndefined()
      })

      it('should $unset on objects dotted path targeted by find query', () => {
        const people = new Collection(...clone(data.people))
        const findResultA = people.findAll({ name: 'Kevin' })
        expect(findResultA[0].name).toBe('Kevin')
        expect(findResultA[0].address.postcode).toBe('L15')
        people.update(
          { name: 'Kevin' },
          {
            $unset: { 'address.postcode': true },
          }
        )
        expect(findResultA[0].address.postcode).toBeUndefined()
      })
    })
  })

  describe('delete()', () => {
    it('should delete items', () => {
      const people = new Collection(...clone(data.people))
      expect(people.length).toBe(4)
      people.delete({ name: 'Kevin' })
      expect(people.length).toBe(3)
      const kevins = people.findAll({ name: 'Kevin' })
      expect(kevins.length).toBe(0)
    })

    it('should delete items using dotted path', () => {
      const people = new Collection(...clone(data.people))
      expect(people.length).toBe(4)
      people.delete({ 'address.postcode': 'L1' })
      expect(people.length).toBe(3)
      const l1s = people.findAll({ 'address.postcode': 'L1' })
      expect(l1s.length).toBe(0)
    })
  })

  describe('replace()', () => {
    it('should replace matched items with given value', () => {
      const people = new Collection(...clone(data.people))
      people.replace(
        { name: 'Kevin' },
        {
          name: 'Tom',
          nationality: 'German',
          address: { postcode: 'ABC' },
        }
      )
      const kevins = people.findAll({ name: 'Kevin' })
      expect(kevins.length).toBe(0)
      const toms = people.findAll({ name: 'Tom' })
      expect(toms.length).toBe(1)
      expect(toms[0].address.postcode).toBe('ABC')
    })

    it('should replace matched items using replacer function', () => {
      const people = new Collection(...clone(data.people))
      people.replace({ name: 'Kevin' }, (oldValue) => {
        oldValue.name = oldValue.name + ' Updated'
        return oldValue
      })
      const kevins = people.findAll({ name: 'Kevin' })
      expect(kevins.length).toBe(0)
      const toms = people.findAll({ name: 'Kevin Updated' })
      expect(toms.length).toBe(1)
    })
  })

  describe('findOneIndex()', () => {
    it('should return index of object element matching find query', () => {
      const people = new Collection(...data.people)
      expect(people.findOneIndex({ name: 'Kevin' })).toBe(0)
      expect(people.findOneIndex({ name: 'Fudge' })).toBe(1)
    })
  })

  describe('moveUp()', () => {
    it('should move element up', () => {
      const people = new Collection(...data.people)

      expect(people[0].name).toBe('Kevin')
      expect(people[1].name).toBe('Fudge')
      expect(people[2].name).toBe('Kar Chun')
      expect(people[3].name).toBe('Alison')

      people.moveUp(3)
      expect(people[0].name).toBe('Kevin')
      expect(people[1].name).toBe('Fudge')
      expect(people[2].name).toBe('Alison')
      expect(people[3].name).toBe('Kar Chun')

      people.moveUp(2)
      expect(people[0].name).toBe('Kevin')
      expect(people[1].name).toBe('Alison')
      expect(people[2].name).toBe('Fudge')
      expect(people[3].name).toBe('Kar Chun')

      people.moveUp(1)
      expect(people[0].name).toBe('Alison')
      expect(people[1].name).toBe('Kevin')
      expect(people[2].name).toBe('Fudge')
      expect(people[3].name).toBe('Kar Chun')
    })
  })

  describe('moveDown()', () => {
    it('should move element down', () => {
      const people = new Collection(...data.people)

      expect(people[0].name).toBe('Kevin')
      expect(people[1].name).toBe('Fudge')
      expect(people[2].name).toBe('Kar Chun')
      expect(people[3].name).toBe('Alison')

      people.moveDown(0)
      expect(people[0].name).toBe('Fudge')
      expect(people[1].name).toBe('Kevin')
      expect(people[2].name).toBe('Kar Chun')
      expect(people[3].name).toBe('Alison')

      people.moveDown(1)
      expect(people[0].name).toBe('Fudge')
      expect(people[1].name).toBe('Kar Chun')
      expect(people[2].name).toBe('Kevin')
      expect(people[3].name).toBe('Alison')

      people.moveDown(2)
      expect(people[0].name).toBe('Fudge')
      expect(people[1].name).toBe('Kar Chun')
      expect(people[2].name).toBe('Alison')
      expect(people[3].name).toBe('Kevin')
    })
  })
})
