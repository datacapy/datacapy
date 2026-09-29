import { Repo } from './repo'

// Verifies that every CRUD method releases its registry ref (see Repo#releaseDataSource) even
// when the underlying dataSource call rejects - a missing try/finally here previously leaked the
// ref forever on error, making the registry entry permanently ineligible for eviction and
// contributing to the "Pool is closed" force-close race in DataSourceRegistry.remove().

type Case = {
  methodName: string
  dataSourceMethodName: string
  run: (repo: Repo<any>) => Promise<any>
}

const cases: Case[] = [
  {
    methodName: 'find',
    dataSourceMethodName: 'find',
    run: (repo) => repo.find({}),
  },
  {
    methodName: 'findOne',
    dataSourceMethodName: 'findOne',
    run: (repo) => repo.findOne({}),
  },
  {
    methodName: 'count',
    dataSourceMethodName: 'count',
    run: (repo) => repo.count({}),
  },
  {
    methodName: 'groupCount',
    dataSourceMethodName: 'groupCount',
    run: (repo) => repo.groupCount(['field']),
  },
  {
    methodName: 'findGroup',
    dataSourceMethodName: 'findGroup',
    run: (repo) => repo.findGroup(['field']),
  },
  {
    methodName: 'insertMany',
    dataSourceMethodName: 'insertMany',
    run: (repo) => repo.insertMany([{}]),
  },
  {
    methodName: 'insertOne',
    dataSourceMethodName: 'insertOne',
    run: (repo) => repo.insertOne({}),
  },
  {
    methodName: 'updateMany',
    dataSourceMethodName: 'updateMany',
    run: (repo) => repo.updateMany({}, { $set: { a: 1 } }),
  },
  {
    methodName: 'updateOne',
    dataSourceMethodName: 'updateOne',
    run: (repo) => repo.updateOne({}, { $set: { a: 1 } }),
  },
  {
    methodName: 'upsertMany',
    dataSourceMethodName: 'upsertMany',
    run: (repo) => repo.upsertMany({}, { $set: { a: 1 } }),
  },
  {
    methodName: 'upsertOne',
    dataSourceMethodName: 'upsertOne',
    run: (repo) => repo.upsertOne({}, { $set: { a: 1 } }),
  },
  {
    methodName: 'deleteMany',
    dataSourceMethodName: 'deleteMany',
    run: (repo) => repo.deleteMany({}),
  },
  {
    methodName: 'deleteOne',
    dataSourceMethodName: 'deleteOne',
    run: (repo) => repo.deleteOne({}),
  },
  {
    methodName: 'bulkWrite',
    dataSourceMethodName: 'bulkWrite',
    run: (repo) => repo.bulkWrite([{ insertOne: { document: {} } }]),
  },
]

describe('Repo CRUD methods release the registry ref on error', () => {
  it.each(cases)(
    '$methodName releases the registry ref even when dataSource.$dataSourceMethodName() rejects',
    async ({ dataSourceMethodName, run }) => {
      const error = new Error('boom')
      const dataSource: any = {
        isDynamic: () => true,
      }
      dataSource[dataSourceMethodName] = jest.fn().mockRejectedValue(error)

      const repo = new Repo({ name: 'thing' })
      repo.dataSource = dataSource
      jest.spyOn(repo, 'getDataSource').mockResolvedValue(dataSource)
      jest.spyOn(repo, 'releaseDataSource')

      await expect(run(repo)).rejects.toThrow('boom')

      expect(repo.releaseDataSource).toHaveBeenCalledTimes(1)
    }
  )
})
