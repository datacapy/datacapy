import { Collection, PropsOf } from '@datacapy/schema'

import Repo from 'repo'
import MockDataSource from 'data-source/mock'

class Albums extends Collection<Album> {}

class Artist {
  _id: string
  name: string
  albums: Albums

  constructor(data: Partial<PropsOf<Artist>>) {
    this._id = data?._id || ''
    this.name = data?.name || ''
    this.albums = new Albums(...data.albums)
  }
}

class Album {
  _id: string
  name: string
  artistId: string
  constructor(data: Partial<PropsOf<Album>>) {
    this._id = data?._id || ''
    this.name = data?.name || ''
    this.artistId = data?.artistId || ''
  }
}

describe('RepoPopulator', function () {
  it('should apply transients to relations', async () => {
    const data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
        { _id: '3', name: 'OK Computer', artistId: '1' },
        { _id: '4', name: 'Kid A', artistId: '1' },
      ],
    }

    const albumRepo = new Repo<Album>({
      name: 'album',
      schema: {
        $constructCollection: Albums,
        $construct: Album,
      },
    })
    albumRepo.dataSource = new MockDataSource(data)

    const artistRepo = new Repo<Artist>({
      name: 'artist',
      relations: {
        albums: {
          alias: 'albums',
          type: 'hasMany',
          repo: 'album',
          key: 'artistId',
          autoPopulate: true,
          recursion: 1,
        },
      },
    })
    artistRepo.dataSource = new MockDataSource(data)

    const repos = [albumRepo, artistRepo] as Repo<any>[]
    const constructors = [Albums]

    albumRepo.addRepos(repos)
    artistRepo.addRepos(repos)
    albumRepo.addConstructors(constructors)
    artistRepo.addConstructors(constructors)

    const docs = await artistRepo.find({ _id: '1' })

    expect(docs[0].albums[0].name).toBe('Pablo Honey')
    expect(docs[0].albums[1].name).toBe('The Bends')
    expect(docs[0].albums[2].name).toBe('OK Computer')
    expect(docs[0].albums[3].name).toBe('Kid A')
    expect(docs[0].albums.constructor).toBe(Albums)
  })
  it('should apply $constructCollection to empty relation', async () => {
    const data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [],
    }

    const albumRepo = new Repo<Album>({
      name: 'album',
      schema: {
        $constructCollection: Albums,
        $construct: Album,
      },
    })
    albumRepo.dataSource = new MockDataSource(data)

    const artistRepo = new Repo<Artist>({
      name: 'artist',
      relations: {
        albums: {
          alias: 'albums',
          type: 'hasMany',
          repo: 'album',
          key: 'artistId',
          autoPopulate: true,
          recursion: 1,
        },
      },
    })
    artistRepo.dataSource = new MockDataSource(data)

    const repos = [albumRepo, artistRepo] as Repo<any>[]
    const constructors = [Albums]

    albumRepo.addRepos(repos)
    artistRepo.addRepos(repos)
    albumRepo.addConstructors(constructors)
    artistRepo.addConstructors(constructors)

    const docs = await artistRepo.find({ _id: '1' })

    expect(Array.isArray(docs[0].albums)).toBeTruthy()
    expect(docs[0].albums.length).toBe(0)
    expect(docs[0].albums.constructor).toBe(Albums)
  })
})
