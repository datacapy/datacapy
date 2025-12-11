import { RelationHasOne } from 'repo-populator/relation/has-one'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('RelationHasOne', () => {
  it('should populate', async () => {
    const data = {
      userTimezone: [{ _id: '1', userId: '9', name: 'Europe/London' }],
      user: [{ _id: '9', name: 'Kevin Foster' }],
    }

    const userTimezone = new Repo({
      name: 'userTimezone',
    })
    userTimezone.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasOne()
    const docs = await repoPopulator.populate(
      userTimezone,
      {
        key: 'userId',
        alias: 'timezone',
      },
      data.user
    )

    expect(docs[0].timezone.name).toBe('Europe/London')
  })

  it('should populate embedded', async () => {
    const data = {
      forum: [
        {
          _id: 'ref12380',
          detail: { topPoster: { _id: '9', name: 'Kevin Foster' } },
        },
      ],
      userTimezone: [{ _id: '5', userId: '9', name: 'Europe/London' }],
    }

    const userTimezone = new Repo({
      name: 'userTimezone',
    })
    userTimezone.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasOne()
    const docs = await repoPopulator.populate(
      userTimezone,
      {
        docPath: 'detail.topPoster',
        key: 'userId',
        alias: 'timezone',
      },
      data.forum
    )

    expect(docs[0].detail.topPoster.timezone.name).toBe('Europe/London')
  })

  it('should populate embedded array', async () => {
    const data = {
      forum: [
        {
          _id: 'ref12380',
          detail: {
            topPosters: [
              { _id: '9', name: 'Kevin Foster' },
              { _id: '12', name: 'Tom Murphy' },
            ],
          },
        },
      ],
      userTimezone: [
        { _id: '5', userId: '9', name: 'Europe/London' },
        { _id: '6', userId: '12', name: 'America/Toronto' },
      ],
    }

    const userTimezone = new Repo({
      name: 'userTimezone',
    })
    userTimezone.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasOne()
    const docs = await repoPopulator.populate(
      userTimezone,
      {
        docPath: 'detail.topPosters.*',
        key: 'userId',
        alias: 'timezone',
      },
      data.forum
    )

    expect(docs[0].detail.topPosters[0].timezone.name).toBe('Europe/London')
    expect(docs[0].detail.topPosters[1].timezone.name).toBe('America/Toronto')
  })

  it('should populate embedded wildcard path', async () => {
    const data = {
      forum: [
        {
          some: {
            unknown: {
              path: {
                _id: 'ref12380',
                detail: { topPoster: { _id: '9', name: 'Kevin Foster' } },
              },
            },
          },
        },
      ],
      userTimezone: [{ _id: '5', userId: '9', name: 'Europe/London' }],
    }

    const userTimezone = new Repo({
      name: 'userTimezone',
    })
    userTimezone.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasOne()
    const docs = await repoPopulator.populate(
      userTimezone,
      {
        docPath: '*.*.*.detail.topPoster',
        key: 'userId',
        alias: 'timezone',
      },
      data.forum
    )

    expect(docs[0].some.unknown.path.detail.topPoster.timezone.name).toBe(
      'Europe/London'
    )
  })
})
