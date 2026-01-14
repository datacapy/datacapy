import { RelationEmbeddedBelongsToMany } from 'repo-populator/relation/embedded-belongs-to-many'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('RelationEmbeddedBelongsToMany', () => {
  it('should populate', async () => {
    const data = {
      recordCompany: [
        {
          artists: [
            {
              _id: '1',
              name: 'Radiohead',
              albumIds: ['1', '2', '3', '4'],
            },
          ],
          albums: [
            { _id: '1', name: 'Pablo Honey' },
            { _id: '2', name: 'The Bends' },
            { _id: '3', name: 'OK Computer' },
            { _id: '4', name: 'Kid A' },
          ],
        },
      ],
    }

    const recordCompany = new Repo({
      name: 'recordCompany',
    })
    recordCompany.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationEmbeddedBelongsToMany()
    // See RepoPopulateRelation.normalizeOptions() comments for description of relation options
    const docs = await repoPopulator.populate(
      recordCompany,
      {
        docPath: 'artists.*',
        docPathRelated: 'albums.*',
        key: 'albumIds',
        alias: 'albums',
      },
      data.recordCompany
    )

    expect(docs[0].artists[0].albums[0].name).toBe('Pablo Honey')
    expect(docs[0].artists[0].albums[1].name).toBe('The Bends')
    expect(docs[0].artists[0].albums[2].name).toBe('OK Computer')
    expect(docs[0].artists[0].albums[3].name).toBe('Kid A')
  })

  it('should populate array of docs', async () => {
    const data = {
      recordCompany: [
        {
          artists: [
            {
              _id: '1',
              name: 'Radiohead',
              albumIds: ['1', '2', '3', '4'],
            },
          ],
          albums: [
            { _id: '1', name: 'Pablo Honey' },
            { _id: '2', name: 'The Bends' },
            { _id: '3', name: 'OK Computer' },
            { _id: '4', name: 'Kid A' },
          ],
        },
        {
          artists: [
            {
              _id: '200',
              name: 'The Mars Volta',
              albumIds: ['21', '22', '23', '24'],
            },
          ],
          albums: [
            { _id: '21', name: 'De-Loused in the Comatorium' },
            { _id: '22', name: 'Frances the Mute' },
            { _id: '23', name: 'Amputechture' },
            { _id: '24', name: 'The Bedlam in Goliath' },
          ],
        },
      ],
    }

    const recordCompany = new Repo({
      name: 'recordCompany',
    })
    recordCompany.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationEmbeddedBelongsToMany()
    // See RepoPopulateRelation.normalizeOptions() comments for description of relation options
    const docs = await repoPopulator.populate(
      recordCompany,
      {
        docPath: 'artists.*',
        docPathRelated: 'albums.*',
        key: 'albumIds',
        alias: 'albums',
      },
      data.recordCompany
    )

    expect(docs[0].artists[0].albums.length).toBe(4)
    expect(docs[0].artists[0].albums[0].name).toBe('Pablo Honey')
    expect(docs[0].artists[0].albums[1].name).toBe('The Bends')
    expect(docs[0].artists[0].albums[2].name).toBe('OK Computer')
    expect(docs[0].artists[0].albums[3].name).toBe('Kid A')
    expect(docs[1].artists[0].albums.length).toBe(4)
    expect(docs[1].artists[0].albums[0].name).toBe(
      'De-Loused in the Comatorium'
    )
    expect(docs[1].artists[0].albums[1].name).toBe('Frances the Mute')
    expect(docs[1].artists[0].albums[2].name).toBe('Amputechture')
    expect(docs[1].artists[0].albums[3].name).toBe('The Bedlam in Goliath')
  })
})
