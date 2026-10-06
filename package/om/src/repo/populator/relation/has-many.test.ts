import { RelationHasMany } from 'repo/populator/relation/has-many'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'
import { DataSourceContext } from 'data-source/context'

describe('RelationHasMany', function () {
  it('should populate', async () => {
    const data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
        { _id: '3', name: 'OK Computer', artistId: '1' },
        { _id: '4', name: 'Kid A', artistId: '1' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasMany()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albums',
      },
      data.artist
    )

    expect(docs[0].albums[0].name).toBe('Pablo Honey')
    expect(docs[0].albums[1].name).toBe('The Bends')
    expect(docs[0].albums[2].name).toBe('OK Computer')
    expect(docs[0].albums[3].name).toBe('Kid A')
  })
  it('should not copy the query context', async () => {
    // Stands in for a database connection: an enumerable accessor with no
    // setter, as a socket exposes on current Node, which clone() cannot copy.
    class LiveHandle {}
    Object.defineProperty(LiveHandle.prototype, 'writeQueueSize', {
      enumerable: true,
      get: () => 0,
    })
    const context = Object.assign(new DataSourceContext(), {
      connection: new LiveHandle(),
    })

    const data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [{ _id: '1', name: 'Pablo Honey', artistId: '1' }],
    }
    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSource(data)
    const find = jest.spyOn(album, 'find')

    const docs = await new RelationHasMany().populate(
      album,
      { key: 'artistId', alias: 'albums', context },
      data.artist
    )

    expect(docs[0].albums[0].name).toBe('Pablo Honey')
    expect(find.mock.calls[0][1]?.context).toBe(context)
  })
  it('should populate embedded', async () => {
    const data = {
      recordCompanies: [
        {
          _id: 'r234',
          name: 'EMI',
          detail: { topArtist: { _id: '7', name: 'Radiohead' } },
        },
      ],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '7' },
        { _id: '2', name: 'The Bends', artistId: '7' },
        { _id: '3', name: 'OK Computer', artistId: '7' },
        { _id: '4', name: 'Kid A', artistId: '7' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasMany()
    const docs = await repoPopulator.populate(
      album,
      {
        docPath: 'detail.topArtist',
        key: 'artistId',
        alias: 'albums',
      },
      data.recordCompanies
    )

    expect(docs[0].detail.topArtist.albums[0].name).toBe('Pablo Honey')
    expect(docs[0].detail.topArtist.albums[1].name).toBe('The Bends')
    expect(docs[0].detail.topArtist.albums[2].name).toBe('OK Computer')
    expect(docs[0].detail.topArtist.albums[3].name).toBe('Kid A')
  })
  it('should populate embedded array', async () => {
    const data = {
      recordCompanies: [
        {
          _id: 'r234',
          name: 'EMI',
          detail: {
            topArtists: [
              { _id: '7', name: 'Radiohead' },
              { _id: '14', name: 'The Mars Volta' },
            ],
          },
        },
      ],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '7' },
        { _id: '2', name: 'The Bends', artistId: '7' },
        { _id: '3', name: 'OK Computer', artistId: '7' },
        { _id: '4', name: 'Kid A', artistId: '7' },

        { _id: '5', name: 'Amputechture', artistId: '14' },
        { _id: '6', name: 'The Bedlam in Goliath', artistId: '14' },
        { _id: '7', name: 'Octahedron', artistId: '14' },
        { _id: '8', name: 'Noctourniquet', artistId: '14' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasMany()
    const docs = await repoPopulator.populate(
      album,
      {
        docPath: 'detail.topArtists.*',
        key: 'artistId',
        alias: 'albums',
      },
      data.recordCompanies
    )

    expect(docs[0].detail.topArtists[0].albums[0].name).toBe('Pablo Honey')
    expect(docs[0].detail.topArtists[0].albums[1].name).toBe('The Bends')
    expect(docs[0].detail.topArtists[0].albums[2].name).toBe('OK Computer')
    expect(docs[0].detail.topArtists[0].albums[3].name).toBe('Kid A')

    expect(docs[0].detail.topArtists[1].albums[0].name).toBe('Amputechture')
    expect(docs[0].detail.topArtists[1].albums[1].name).toBe(
      'The Bedlam in Goliath'
    )
    expect(docs[0].detail.topArtists[1].albums[2].name).toBe('Octahedron')
    expect(docs[0].detail.topArtists[1].albums[3].name).toBe('Noctourniquet')
  })
  it('should populate embedded wildcard path', async () => {
    const data = {
      recordCompanies: [
        {
          some: {
            unknown: {
              path: {
                _id: 'r234',
                name: 'EMI',
                detail: { topArtist: { _id: '7', name: 'Radiohead' } },
              },
            },
          },
        },
      ],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '7' },
        { _id: '2', name: 'The Bends', artistId: '7' },
        { _id: '3', name: 'OK Computer', artistId: '7' },
        { _id: '4', name: 'Kid A', artistId: '7' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationHasMany()
    const docs = await repoPopulator.populate(
      album,
      {
        docPath: '*.*.*.detail.topArtist',
        key: 'artistId',
        alias: 'albums',
      },
      data.recordCompanies
    )

    expect(docs[0].some.unknown.path.detail.topArtist.albums[0].name).toBe(
      'Pablo Honey'
    )
    expect(docs[0].some.unknown.path.detail.topArtist.albums[1].name).toBe(
      'The Bends'
    )
    expect(docs[0].some.unknown.path.detail.topArtist.albums[2].name).toBe(
      'OK Computer'
    )
    expect(docs[0].some.unknown.path.detail.topArtist.albums[3].name).toBe(
      'Kid A'
    )
  })
})
