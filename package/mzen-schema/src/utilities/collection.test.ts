import { Collection } from './collection'

const data = {
  people: [
    { name: 'Kevin' },
    { name: 'Fudge' },
    { name: 'Kar Chun' },
    { name: 'Alison' },
  ],
}

describe('Collection', () => {
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
