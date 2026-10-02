import {
  DataSourceMongodb,
  DataSourceMock,
  DataSourceInterface,
  DataSourceMysql,
  DataSourceDynamic,
  DataSourceRedis,
  DataSourceRegistry,
  DataSourceRegistryConfig,
  DataSourceLookup,
  DataSourceContext,
  DataSourceContextEntry,
} from 'data-source'
import { Logger, ModelManagerConfigDataSource } from 'model-manager'

// Structural type to avoid circular dependency with Repo
type RepoLike = {
  config: {
    dataSource?: string
    collectionName?: string
    indexes?: any
  }
  getName(): string
  dataSource?: DataSourceInterface
  init(context?: DataSourceContext): Promise<void>
}

/**
 * DataSourceManager
 *
 * Manages all datasource concerns including static and dynamic datasources.
 * Separated from ModelManager to maintain single responsibility.
 */
export class DataSourceManager {
  dataSources: { [key: string]: DataSourceInterface }
  dataSourceRegistry?: DataSourceRegistry
  dataSourceLookups: Map<string, DataSourceLookup>
  dynamicRepos: string[] // Track repos with dynamic datasources
  logger: Logger

  constructor(
    logger: Logger,
    registryConfig?: DataSourceRegistryConfig,
    enableDynamic?: boolean
  ) {
    this.dataSources = {}
    this.dataSourceLookups = new Map()
    this.dynamicRepos = []
    this.logger = logger

    // Initialize dynamic datasource registry if enabled
    if (enableDynamic) {
      this.dataSourceRegistry = new DataSourceRegistry({
        ...registryConfig,
        logger: this.logger,
      })
      this.logger.log('[DataSourceManager] Dynamic datasources enabled')
    }
  }

  async initDataSourceFromConfig(options: ModelManagerConfigDataSource) {
    switch (options.type) {
      case 'mysql':
        return await this.initDataSource(
          options.name,
          new DataSourceMysql(options.config as any)
        )
        break
      case 'mongodb':
        return await this.initDataSource(
          options.name,
          new DataSourceMongodb(options.config as any)
        )
        break
      case 'mock':
        return await this.initDataSource(
          options.name,
          new DataSourceMock((options as any).data ? (options as any).data : {})
        )
        break
      case 'redis':
        return await this.initDataSource(
          options.name,
          new DataSourceRedis(options.config as any)
        )
        break
      case 'dynamic':
        // Create placeholder datasource - doesn't connect
        const ds = new DataSourceDynamic(options.config || {})
        this.addDataSource(options.name, ds)
        this.logger.log(
          `[DataSourceManager] Created DynamicDataSource placeholder: ${options.name}`
        )
        return ds
        break
    }
  }

  async initDataSource(name: string, dataSource) {
    await DataSourceRegistry.connectWithRetry(dataSource)
    this.addDataSource(name, dataSource)

    return dataSource
  }

  async loadDataSources(configs: ModelManagerConfigDataSource[]) {
    let promises: Promise<DataSourceInterface>[] = []
    configs.forEach((dataSource) => {
      promises.push(this.initDataSourceFromConfig(dataSource))
    })
    await Promise.all(promises)
  }

  getDataSource(name: string) {
    return this.dataSources[name]
  }

  addDataSource(name: string, dataSource: DataSourceInterface) {
    this.dataSources[name] = dataSource
  }

  /**
   * Get a datasource with dynamic resolution support.
   * Supports both static and dynamic datasource modes.
   *
   * @param key - Datasource name or lookup key
   * @param entry - Optional context entry for dynamic resolution
   * @returns Datasource instance
   */
  async getDataSourceDynamic(
    key: string,
    entry?: DataSourceContextEntry
  ): Promise<DataSourceInterface> {
    // Priority 1: Explicit dataSourceKey in entry
    if (entry?.dataSourceKey) {
      const ds = this.dataSources[entry.dataSourceKey]
      if (ds) {
        return ds
      }
      if (!entry.useDefault) {
        throw new Error(`DataSource not found: ${entry.dataSourceKey}`)
      }
    }

    // Priority 2: Dynamic lookup via lookupKey
    if (entry?.lookupKey && this.dataSourceRegistry) {
      const lookup = this.dataSourceLookups.get(key)
      if (!lookup) {
        throw new Error(
          `No DataSourceLookup configured for datasource "${key}". ` +
            `Available datasources: ${Array.from(this.dataSourceLookups.keys()).join(', ')}`
        )
      }
      try {
        const registryKey = DataSourceRegistry.makeKey(key, entry.lookupKey)
        const dataSource = await this.dataSourceRegistry.getOrCreate(
          registryKey,
          async () => {
            const details = await lookup.lookup(key, entry.lookupKey!)
            if (!details) {
              throw new Error(
                `No datasource configuration found for datasource "${key}" with key: ${entry.lookupKey}`
              )
            }
            return await this.dataSourceRegistry!.createDataSourceFromDetails(
              details
            )
          }
        )
        return dataSource
      } catch (error) {
        if (!entry.useDefault) {
          throw error
        }
        this.logger.warn(
          `Failed to get dynamic datasource for "${key}" with key ${entry.lookupKey}, falling back to default`,
          error
        )
      }
    }

    // Priority 3: Static datasource by key
    const staticDs = this.dataSources[key]
    if (staticDs) {
      return staticDs
    }

    // Priority 4: Default datasource
    const defaultKey = Object.keys(this.dataSources)[0]
    if (defaultKey && (entry?.useDefault || !entry)) {
      return this.dataSources[defaultKey]
    }

    throw new Error(`No datasource available for key: ${key}`)
  }

  /**
   * Set the datasource lookup implementation for a specific datasource
   *
   * @param name - Datasource name (e.g., 'workspace')
   * @param lookup - DataSourceLookup implementation
   */
  setDataSourceLookup(name: string, lookup: DataSourceLookup) {
    this.dataSourceLookups.set(name, lookup)
  }

  /**
   * Get the datasource lookup implementation for a specific datasource
   *
   * @param name - Datasource name
   * @returns DataSourceLookup implementation or undefined
   */
  getDataSourceLookup(name: string): DataSourceLookup | undefined {
    return this.dataSourceLookups.get(name)
  }

  /**
   * Track a repo as having a dynamic datasource
   *
   * @param name - Repo name
   */
  trackDynamicRepo(name: string) {
    this.dynamicRepos.push(name)
  }

  /**
   * Initialize a single dynamic repo by creating its indexes on the resolved datasource
   *
   * @param repoName - Name of the repo to initialize
   * @param context - DataSourceContext with lookupKey for datasource resolution
   * @param repos - Map of repos to use for lookup
   */
  async initDynamicRepo(
    repoName: string,
    context: DataSourceContext,
    repos: { [key: string]: RepoLike }
  ): Promise<void> {
    const repo = repos[repoName]
    if (!repo) {
      throw new Error(`Repo not found: ${repoName}`)
    }

    await repo.init(context)

    this.logger.log(
      `[DataSourceManager] Initialized dynamic repo: ${repoName} for datasource: ${repo.config.dataSource}`
    )
  }

  /**
   * Initialize all dynamic repos for a specific datasource name
   *
   * @param dsName - Name of the dynamic datasource (e.g., 'workspace')
   * @param context - DataSourceContext with lookupKey for datasource resolution
   * @param repos - Map of repos to use for lookup
   */
  async initDynamicReposForDataSource(
    dsName: string,
    context: DataSourceContext,
    repos: { [key: string]: RepoLike }
  ): Promise<void> {
    const repoList = Object.values(repos).filter(
      (r) => r.config.dataSource === dsName
    )

    this.logger.log(
      `[DataSourceManager] Initializing ${repoList.length} dynamic repos for datasource: ${dsName}`
    )

    for (const repo of repoList) {
      await this.initDynamicRepo(repo.getName(), context, repos)
    }

    this.logger.log(
      `[DataSourceManager] Initialized ${repoList.length} dynamic repos for datasource: ${dsName}`
    )
  }

  /**
   * Close the dynamic datasource registry
   */
  async closeRegistry() {
    if (this.dataSourceRegistry) {
      await this.dataSourceRegistry.close()
    }
  }

  /**
   * Close all static datasources
   */
  async closeAll() {
    let promises: Promise<void>[] = []
    Object.values(this.dataSources).forEach(async (dataSource) => {
      promises.push(dataSource.close())
    })
    await Promise.all(promises)
  }
}

export default DataSourceManager
