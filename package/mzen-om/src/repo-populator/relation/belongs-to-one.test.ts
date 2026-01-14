import { RelationBelongsToOne } from 'repo-populator/relation/belongs-to-one'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'

describe('RelationBelongsToOne', function () {
  it('should populate', async () => {
    const data = {
      artist: [{ _id: '1', name: 'Radiohead', createdByUserId: '1' }],
      user: [{ _id: '1', name: 'Kevin Foster' }],
    }

    const user = new Repo({
      name: 'user',
    })
    user.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      user,
      {
        key: 'createdByUserId',
        alias: 'createdByUser',
      },
      data.artist
    )

    expect(docs[0].createdByUser.name).toBe('Kevin Foster')
  })
  it('should populate embedded', async () => {
    const data = {
      product: [
        {
          _id: '1',
          detail: {
            more: {
              name: 'Macbook Pro',
              createdByUserId: '1',
            },
          },
        },
        {
          _id: '2',
          detail: {
            more: {
              name: 'MSI GE60',
              createdByUserId: '2',
            },
          },
        },
      ],
      user: [
        { _id: '1', name: 'Kevin Foster' },
        { _id: '2', name: 'Tom Murphy' },
      ],
    }

    const user = new Repo({
      name: 'user',
    })
    user.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      user,
      {
        docPath: 'detail.more',
        key: 'createdByUserId',
        alias: 'createdByUser',
      },
      data.product
    )

    expect(docs[0].detail.more.createdByUser.name).toBe('Kevin Foster')
    expect(docs[1].detail.more.createdByUser.name).toBe('Tom Murphy')
  })
  it('should populate embedded array', async () => {
    const data = {
      product: [
        {
          _id: '1',
          detail: {
            more: [
              {
                name: 'Macbook Pro',
                createdByUserId: '1',
              },
              {
                name: 'MSI GE60',
                createdByUserId: '2',
              },
            ],
          },
        },
      ],
      user: [
        { _id: '1', name: 'Kevin Foster' },
        { _id: '2', name: 'Tom Murphy' },
      ],
    }

    const user = new Repo({
      name: 'user',
    })
    user.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      user,
      {
        docPath: 'detail.more.*',
        key: 'createdByUserId',
        alias: 'createdByUser',
      },
      data.product
    )

    expect(docs[0].detail.more[0].createdByUser.name).toBe('Kevin Foster')
    expect(docs[0].detail.more[1].createdByUser.name).toBe('Tom Murphy')
  })
  it('should populate embedded wildcard path', async () => {
    const data = {
      product: [
        {
          some: {
            unknown: {
              path: {
                _id: 'a1',
                detail: {
                  more: {
                    name: 'Macbook Pro',
                    createdByUserId: '1',
                  },
                },
              },
            },
          },
        },
        {
          some: {
            unknown: {
              path: {
                _id: 'a2',
                detail: {
                  more: {
                    name: 'MSI GE60',
                    createdByUserId: '2',
                  },
                },
              },
            },
          },
        },
      ],
      user: [
        { _id: '1', name: 'Kevin Foster' },
        { _id: '2', name: 'Tom Murphy' },
      ],
    }

    const user = new Repo({
      name: 'user',
    })
    user.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docs = await repoPopulator.populate(
      user,
      {
        docPath: '*.*.*.detail.more',
        key: 'createdByUserId',
        alias: 'createdByUser',
      },
      data.product
    )

    expect(docs[0].some.unknown.path.detail.more.createdByUser.name).toBe(
      'Kevin Foster'
    )
    expect(docs[1].some.unknown.path.detail.more.createdByUser.name).toBe(
      'Tom Murphy'
    )
  })
  it('should populate multiple doc paths with the same alias', async () => {
    const data = {
      business: [
        { _id: '1', name: 'Google' },
        { _id: '2', name: 'Amazon' },
        { _id: '3', name: 'Microsoft' },
        { _id: '4', name: 'DigitalOcean' },
      ],
      user: [
        {
          _id: '1',
          name: 'Kevin Foster',
          businessCustomer: [{ businessId: '1' }, { businessId: '2' }],
          businessSupplier: [{ businessId: '3' }, { businessId: '4' }],
        },
      ],
    }

    const business = new Repo({
      name: 'business',
    })
    business.dataSource = new MockDataSource(data)

    const repoPopulator = new RelationBelongsToOne()
    const docsA = await repoPopulator.populate(
      business,
      {
        alias: 'business',
        docPath: 'businessCustomer.*',
        key: 'businessId',
      },
      data.user
    )

    const docsB = await repoPopulator.populate(
      business,
      {
        alias: 'business',
        docPath: 'businessSupplier.*',
        key: 'businessId',
      },
      data.user
    )

    expect(docsA[0].businessCustomer[0].business.name).toBe('Google')
    expect(docsB[0].businessSupplier[0].business.name).toBe('Microsoft')
  })
})
