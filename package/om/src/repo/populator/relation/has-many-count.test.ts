import { RelationHasManyCount } from 'repo/populator/relation/has-many-count'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'
import { QuerySelection } from 'data-source/interface'

// Custom mock data source that implements groupCount properly
class MockDataSourceWithGroupCount extends MockDataSource {
  // Helper to match a document against a query with extended operator support
  private matchesQueryExtended(doc: any, query?: QuerySelection): boolean {
    if (!query) return true

    // Handle $or operator
    if (query['$or']) {
      const orConditions = query['$or']
      return orConditions.some((condition) =>
        this.matchesQueryExtended(doc, condition)
      )
    }

    // Handle regular field matching
    for (var key in query) {
      if (!query.hasOwnProperty(key)) continue
      if (key === '$or') continue // Already handled above

      var queryValue = query[key]

      // Handle comparison operators
      if (typeof queryValue === 'object' && !Array.isArray(queryValue)) {
        // Check for $in operator
        if (Array.isArray(queryValue['$in'])) {
          if (queryValue['$in'].indexOf(doc[key]) === -1) {
            return false
          }
        }
        // Check for comparison operators
        if (queryValue['$gte'] !== undefined && doc[key] < queryValue['$gte']) {
          return false
        }
        if (queryValue['$gt'] !== undefined && doc[key] <= queryValue['$gt']) {
          return false
        }
        if (queryValue['$lte'] !== undefined && doc[key] > queryValue['$lte']) {
          return false
        }
        if (queryValue['$lt'] !== undefined && doc[key] >= queryValue['$lt']) {
          return false
        }
        if (queryValue['$ne'] !== undefined && doc[key] === queryValue['$ne']) {
          return false
        }
      } else {
        // Simple equality check
        if (doc[key] !== queryValue) {
          return false
        }
      }
    }
    return true
  }

  // Override filterData to use extended query matching
  filterData(collectionName: string, query?: QuerySelection, options?: any) {
    options = options ? options : {}
    var data = this.data[collectionName]
    var result: any[] = []
    for (var x in data) {
      var matches = this.matchesQueryExtended(data[x], query)
      if (matches) {
        result.push(data[x])
      }
      if (options['limit'] && result.length == options['limit']) break
    }
    return result
  }

  async groupCount(
    collectionName: string,
    groupFields: string[],
    query?: QuerySelection
  ): Promise<Array<{ _id: any; count: number }>> {
    const data = this.filterData(collectionName, query)
    const groupMap = new Map<string, number>()

    // Group by the specified fields and count
    data.forEach((doc) => {
      const keyObj: any = {}
      groupFields.forEach((field) => {
        keyObj[field] = doc[field]
      })
      const key = JSON.stringify(keyObj)
      groupMap.set(key, (groupMap.get(key) || 0) + 1)
    })

    // Convert to the expected format
    const result: Array<{ _id: any; count: number }> = []
    groupMap.forEach((count, key) => {
      result.push({
        _id: JSON.parse(key),
        count,
      })
    })

    return result
  }
}

describe('RelationHasManyCount', function () {
  it('should populate with count of related items', async () => {
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
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist
    )

    expect(docs[0].albumCount).toBe(4)
  })

  it('should populate with count for multiple artists', async () => {
    const data = {
      artist: [
        { _id: '1', name: 'Radiohead' },
        { _id: '2', name: 'The Mars Volta' },
      ],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
        { _id: '3', name: 'OK Computer', artistId: '1' },
        { _id: '4', name: 'Amputechture', artistId: '2' },
        { _id: '5', name: 'The Bedlam in Goliath', artistId: '2' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist
    )

    expect(docs[0].albumCount).toBe(3)
    expect(docs[1].albumCount).toBe(2)
  })

  it('should handle artists with no albums', async () => {
    const data = {
      artist: [
        { _id: '1', name: 'Radiohead' },
        { _id: '2', name: 'Artist With No Albums' },
      ],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist
    )

    expect(docs[0].albumCount).toBe(2)
    expect(docs[1].albumCount).toBeUndefined()
  })

  it('should populate embedded document', async () => {
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
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        docPath: 'detail.topArtist',
        key: 'artistId',
        alias: 'albumCount',
      },
      data.recordCompanies
    )

    expect(docs[0].detail.topArtist.albumCount).toBe(3)
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
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        docPath: 'detail.topArtists.*',
        key: 'artistId',
        alias: 'albumCount',
      },
      data.recordCompanies
    )

    expect(docs[0].detail.topArtists[0].albumCount).toBe(4)
    expect(docs[0].detail.topArtists[1].albumCount).toBe(3)
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
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        docPath: '*.*.*.detail.topArtist',
        key: 'artistId',
        alias: 'albumCount',
      },
      data.recordCompanies
    )

    expect(docs[0].some.unknown.path.detail.topArtist.albumCount).toBe(2)
  })

  it('should handle custom key field', async () => {
    const data = {
      category: [{ categoryId: 'cat1', name: 'Rock' }],
      product: [
        { _id: '1', name: 'Product 1', category: 'cat1' },
        { _id: '2', name: 'Product 2', category: 'cat1' },
        { _id: '3', name: 'Product 3', category: 'cat1' },
      ],
    }

    const product = new Repo({
      name: 'product',
    })
    product.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      product,
      {
        pkey: 'categoryId',
        key: 'category',
        alias: 'productCount',
      },
      data.category
    )

    expect(docs[0].productCount).toBe(3)
  })

  it('should handle query filter', async () => {
    const data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1', year: 1993 },
        { _id: '2', name: 'The Bends', artistId: '1', year: 1995 },
        { _id: '3', name: 'OK Computer', artistId: '1', year: 1997 },
        { _id: '4', name: 'Kid A', artistId: '1', year: 2000 },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCountAfter1995',
        query: { year: { $gte: 1995 } },
      },
      data.artist
    )

    expect(docs[0].albumCountAfter1995).toBe(3)
  })

  it('should return unchanged docs when no relation ids found', async () => {
    const data = {
      artist: [{ _id: '1' }], // No _id field by default
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '999' },
        { _id: '2', name: 'The Bends', artistId: '999' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist
    )

    expect(docs).toEqual(data.artist)
    expect(docs[0].albumCount).toBeUndefined()
  })

  it('should handle empty docs array', async () => {
    const data = {
      artist: [],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist
    )

    expect(docs).toEqual([])
  })

  it('should handle numeric IDs', async () => {
    const data = {
      artist: [
        { _id: 1, name: 'Radiohead' },
        { _id: 2, name: 'The Mars Volta' },
      ],
      album: [
        { _id: 1, name: 'Pablo Honey', artistId: 1 },
        { _id: 2, name: 'The Bends', artistId: 1 },
        { _id: 3, name: 'Amputechture', artistId: 2 },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist
    )

    expect(docs[0].albumCount).toBe(2)
    expect(docs[1].albumCount).toBe(1)
  })

  it('should handle single document instead of array', async () => {
    const data = {
      artist: [{ _id: '1', name: 'Radiohead' }],
      album: [
        { _id: '1', name: 'Pablo Honey', artistId: '1' },
        { _id: '2', name: 'The Bends', artistId: '1' },
      ],
    }

    const album = new Repo({
      name: 'album',
    })
    album.dataSource = new MockDataSourceWithGroupCount(data)

    const repoPopulator = new RelationHasManyCount()
    const docs = await repoPopulator.populate(
      album,
      {
        key: 'artistId',
        alias: 'albumCount',
      },
      data.artist[0] // Pass single doc instead of array
    )

    // When a single doc is passed, populateValues converts it to an array
    expect(Array.isArray(docs)).toBe(true)
    expect(docs[0].albumCount).toBe(2)
  })
})
