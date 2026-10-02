import DataSourceManager from 'data-source-manager'
import Repo from 'repo'
import MockDataSource from 'data-source/mock'
import { DataSourceContext, DataSourceLookup } from 'data-source'

// A DataSourceLookup that must never actually be invoked in these tests —
// the registry entry is always pre-seeded so getOrCreate() short-circuits
// to a refCount increment without calling the factory (and therefore
// without calling lookup()).
const unusedLookup: DataSourceLookup = {
  lookup: async () => {
    throw new Error(
      'lookup() should not be called when the entry is pre-seeded'
    )
  },
}

describe('DataSourceManager', () => {
  const dsName = 'workspace'
  const lookupKey = 'ws1'
  const registryKey = `${dsName}:${lookupKey}`

  function buildManager(repoCount: number) {
    const manager = new DataSourceManager(console, undefined, true)
    manager.setDataSourceLookup(dsName, unusedLookup)

    // Pre-seed the registry so getOrCreate() resolves without a real lookup/connection.
    const mockDataSource = new MockDataSource({})
    return manager
      .dataSourceRegistry!.getOrCreate(registryKey, async () => mockDataSource)
      .then(() => {
        const repos: { [key: string]: Repo<any> } = {}
        for (let i = 0; i < repoCount; i++) {
          const repo = new Repo({
            name: `repo${i}`,
            dataSource: dsName,
            autoIndex: false,
          })
          repos[repo.getName()] = repo
        }
        return { manager, repos }
      })
  }

  it('releases the reference acquired for each dynamic repo after initDynamicReposForDataSource', async () => {
    const { manager, repos } = await buildManager(18)
    const context = DataSourceContext.fromDataSources({
      [dsName]: { lookupKey },
    })

    // Pre-seed left refCount at 1; initializing 18 repos must not leave it at 19.
    await manager.initDynamicReposForDataSource(dsName, context, repos)

    const entry = manager
      .dataSourceRegistry!.getStats()
      .entries.find((e) => e.key === registryKey)
    expect(entry?.refCount).toBe(1)

    // repo.dataSource must stay unset - wiring it directly (the pre-a33a58a9
    // behaviour) let one workspace's resolved datasource leak onto the shared
    // repo singleton and silently misroute every other workspace's queries.
    Object.values(repos).forEach((repo) => {
      expect(repo.dataSource).toBeUndefined()
    })
  })

  it('still releases the reference if one repo throws during init', async () => {
    const { manager, repos } = await buildManager(3)
    const repoNames = Object.keys(repos)
    const failingRepo = repos[repoNames[1]]
    jest
      .spyOn(failingRepo, 'init')
      .mockRejectedValue(new Error('index creation failed'))

    const context = DataSourceContext.fromDataSources({
      [dsName]: { lookupKey },
    })

    await expect(
      manager.initDynamicReposForDataSource(dsName, context, repos)
    ).rejects.toThrow('index creation failed')

    const entry = manager
      .dataSourceRegistry!.getStats()
      .entries.find((e) => e.key === registryKey)
    expect(entry?.refCount).toBe(1)
  })
})
