import { RelationEmbeddedHasOne } from 'repo/populator/relation/embedded-has-one'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('RelationEmbeddedHasOne', () => {
  it('should populate', async () => {
    const data = {
      docs: [
        {
          userTimezone: [{ _id: '1', userId: '9', name: 'Europe/London' }],
          user: [{ _id: '9', name: 'Kevin Foster' }],
        },
      ],
    }

    const doc = new Repo({
      name: 'docs',
    })
    doc.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationEmbeddedHasOne()
    // See RepoPopulateRelation.normalizeOptions() comments for description of relation options
    const docs = await repoPopulator.populate(
      doc,
      {
        docPath: 'user.*',
        docPathRelated: 'userTimezone.*',
        key: 'userId',
        alias: 'timezone',
      },
      data.docs
    )

    expect(docs[0].user[0].timezone.name).toBe('Europe/London')
  })

  it('should populate array of docs', async () => {
    const data = {
      docs: [
        {
          userTimezone: [{ _id: '1', userId: '9', name: 'Europe/London' }],
          user: [{ _id: '9', name: 'Kevin Foster' }],
        },
        {
          userTimezone: [{ _id: '2', userId: '29', name: 'Asia/Kuala_Lumpur' }],
          user: [{ _id: '29', name: 'Andy Jovan' }],
        },
      ],
    }

    const doc = new Repo({
      name: 'docs',
    })
    doc.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationEmbeddedHasOne()
    // See RepoPopulateRelation.normalizeOptions() comments for description of relation options
    const docs = await repoPopulator.populate(
      doc,
      {
        docPath: 'user.*',
        docPathRelated: 'userTimezone.*',
        key: 'userId',
        alias: 'timezone',
      },
      data.docs
    )

    expect(docs[0].user[0].timezone.name).toBe('Europe/London')
    expect(docs[1].user[0].timezone.name).toBe('Asia/Kuala_Lumpur')
  })
})
