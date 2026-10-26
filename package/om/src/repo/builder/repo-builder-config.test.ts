import { repib, relb } from './index'
import { TYPE_HINT_TIMESTAMP } from '../type-hints'
import Repo from 'repo'

describe('Repo index and relation builder config', () => {
  const plainIndexes = {
    createdAt: {
      spec: { createdAt: -1 },
      options: { typeHint: TYPE_HINT_TIMESTAMP },
    },
    email: { spec: { email: 1 }, options: { unique: true } },
  }
  const plainRelations = {
    client: {
      alias: 'client',
      type: 'hasMany',
      repo: 'userClient',
      key: 'userId',
      autoPopulate: false,
    },
  }

  it('accepts builders in an indexes object without build()', () => {
    const repo = new Repo({
      name: 'user',
      indexes: {
        createdAt: repib.desc('createdAt').timestamp(),
        email: repib.asc('email').unique(),
      },
    })
    expect(repo.config.indexes).toEqual(plainIndexes)
    expect(repo.hasIndexes()).toBe(true)
  })

  it('accepts builders in an indexes array, mixed with plain config', () => {
    const repo = new Repo({
      name: 'user',
      indexes: [repib.asc('email').unique(), plainIndexes.createdAt],
    })
    expect(repo.config.indexes).toEqual([
      plainIndexes.email,
      plainIndexes.createdAt,
    ])
  })

  it('accepts relation builders and defaults the alias to the key', () => {
    const repo = new Repo({
      name: 'user',
      relations: {
        client: relb.hasMany('userClient').key('userId').autoPopulate(false),
      },
    })
    expect(repo.config.relations).toEqual(plainRelations)
    expect(repo.relationPaths).toEqual(['client'])
  })

  it('keeps plain relation and index config working', () => {
    const repo = new Repo({
      name: 'user',
      indexes: plainIndexes,
      relations: plainRelations,
    })
    expect(repo.config.indexes).toEqual(plainIndexes)
    expect(repo.config.relations).toEqual(plainRelations)
  })

  it('names created indexes after the object key', async () => {
    const repo = new Repo({
      name: 'user',
      autoIndex: false,
      indexes: { byEmail: repib.asc('email').unique() },
    })
    const createIndex = jest.fn().mockResolvedValue(undefined)
    repo.createIndex = createIndex
    await repo.createIndexes()
    expect(createIndex).toHaveBeenCalledWith(
      { email: 1 },
      { unique: true, name: 'byEmail' },
      undefined
    )
  })
})
