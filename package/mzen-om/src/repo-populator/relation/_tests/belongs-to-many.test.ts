import { RelationBelongsToMany } from 'repo-populator/relation/belongs-to-many'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('RelationBelongsToMany', function () {
  it('should populate', async () => {
    const data = {
      person: [
        { _id: '1', name: 'Kevin Foster', favouriteColorIds: ['1', '5'] },
      ],
      color: [
        { _id: '1', name: 'Red' },
        { _id: '2', name: 'Orange' },
        { _id: '3', name: 'Yellow' },
        { _id: '5', name: 'Green' },
        { _id: '6', name: 'Blue' },
      ],
    }

    const color = new Repo({
      name: 'color',
    })
    color.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToMany()
    const docs = await repoPopulator.populate(
      color,
      {
        key: 'favouriteColorIds',
        alias: 'favouriteColors',
      },
      data.person
    )

    expect(docs[0].favouriteColors[0].name).toBe('Red')
    expect(docs[0].favouriteColors[1].name).toBe('Green')
  })
  it('should populate embedded', async () => {
    const data = {
      person: [
        {
          _id: '1',
          name: 'Kevin Foster',
          about: { trivia: { favouriteColorIds: ['1', '5'] } },
        },
      ],
      color: [
        { _id: '1', name: 'Red' },
        { _id: '2', name: 'Orange' },
        { _id: '3', name: 'Yellow' },
        { _id: '5', name: 'Green' },
        { _id: '6', name: 'Blue' },
      ],
    }

    const color = new Repo({
      name: 'color',
    })
    color.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToMany()
    const docs = await repoPopulator.populate(
      color,
      {
        docPath: 'about.trivia',
        key: 'favouriteColorIds',
        alias: 'favouriteColors',
      },
      data.person
    )

    expect(docs[0].about.trivia.favouriteColors[0].name).toBe('Red')
    expect(docs[0].about.trivia.favouriteColors[1].name).toBe('Green')
  })
  it('should populate embedded array', async () => {
    const data = {
      person: [
        {
          _id: '1',
          name: 'Kevin Foster',
          about: {
            trivia: [
              { favouriteColorIds: ['1', '5'] },
              { favouriteColorIds: ['2', '6'] },
            ],
          },
        },
      ],
      color: [
        { _id: '1', name: 'Red' },
        { _id: '2', name: 'Orange' },
        { _id: '3', name: 'Yellow' },
        { _id: '5', name: 'Green' },
        { _id: '6', name: 'Blue' },
      ],
    }

    const color = new Repo({
      name: 'color',
    })
    color.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToMany()
    const docs = await repoPopulator.populate(
      color,
      {
        docPath: 'about.trivia.*',
        key: 'favouriteColorIds',
        alias: 'favouriteColors',
      },
      data.person
    )

    expect(docs[0].about.trivia[0].favouriteColors[0].name).toBe('Red')
    expect(docs[0].about.trivia[0].favouriteColors[1].name).toBe('Green')
    expect(docs[0].about.trivia[1].favouriteColors[0].name).toBe('Orange')
    expect(docs[0].about.trivia[1].favouriteColors[1].name).toBe('Blue')
  })
  it('should populate embedded wildcard path', async () => {
    const data = {
      person: [
        {
          _id: '1',
          name: 'Kevin Foster',
          about: {
            unknown: { path: { trivia: { favouriteColorIds: ['1', '5'] } } },
          },
        },
      ],
      color: [
        { _id: '1', name: 'Red' },
        { _id: '2', name: 'Orange' },
        { _id: '3', name: 'Yellow' },
        { _id: '5', name: 'Green' },
        { _id: '6', name: 'Blue' },
      ],
    }

    const color = new Repo({
      name: 'color',
    })
    color.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToMany()
    const docs = await repoPopulator.populate(
      color,
      {
        docPath: 'about.*.*.trivia',
        key: 'favouriteColorIds',
        alias: 'favouriteColors',
      },
      data.person
    )

    expect(docs[0].about.unknown.path.trivia.favouriteColors[0].name).toBe(
      'Red'
    )
    expect(docs[0].about.unknown.path.trivia.favouriteColors[1].name).toBe(
      'Green'
    )
  })
})
