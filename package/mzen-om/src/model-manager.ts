import {
  DataSourceMongodb,
  DataSourceMock,
  DataSourceInterface,
  DataSourceMysql,
  DataSourceDynamic,
  DataSourceRegistry,
  DataSourceRegistryConfig,
  DataSourceLookup,
  DataSourceContext,
  DataSourceContextEntry,
} from 'data-source'
import Repo from 'repo'
import RepoPopulator from 'repo/populator'
import Service from 'service'
import Schema from 'mzen-schema'

export interface Logger extends Console {}

export interface ModelManagerConfigDataSource {
  name?: string
  type?: 'mongodb' | 'mock' | 'mysql' | 'dynamic' | string
  config?: { [key: string]: any }
}

export interface ModelManagerConfig {
  dataSources?: Array<ModelManagerConfigDataSource>
  constructors?: { [key: string]: any } | Array<any>
  schemas?: { [key: string]: Schema } | Array<Schema>
  repos?: { [key: string]: Repo<any> } | Array<Repo<any>>
  services?: { [key: string]: Service } | Array<Service>
  app?: any // adhoc app configuration passed by consumers

  // Dynamic datasource configuration
  enableDynamicDataSources?: boolean
  dataSourceRegistryConfig?: DataSourceRegistryConfig
}

/**
 * ModelManager
 *
 * The model manager is responsible for loading and initializing repositories, services.
 * It loads repository and service class definitions from the file system.
 */
export class ModelManager {
  initialised: boolean
  initialisers: {
    [key: string]: Function[]
  }
  shutdownHandlers: {
    [key: string]: Function[]
  }
  config: ModelManagerConfig
  dataSources: { [key: string]: DataSourceInterface }
  constructors: { [key: string]: Function }
  schemas: { [key: string]: Schema }
  repos: { [key: string]: Repo<any> }
  services: { [key: string]: Service }
  repoPopulator?: RepoPopulator
  logger: Logger

  // Dynamic datasource support
  dataSourceRegistry?: DataSourceRegistry
  dataSourceLookup?: DataSourceLookup
  dynamicRepos: string[] // Track repos with dynamic datasources

  constructor(options?: ModelManagerConfig) {
    this.config = options ? options : {}
    this.config.dataSources = this.config.dataSources
      ? this.config.dataSources
      : []
    this.config.constructors = this.config.constructors
      ? this.config.constructors
      : {}
    this.config.schemas = this.config.schemas ? this.config.schemas : {}
    this.config.repos = this.config.repos ? this.config.repos : {}
    this.config.services = this.config.services ? this.config.services : {}

    this.logger = console

    this.initialised = false
    this.initialisers = {}
    this.shutdownHandlers = {}
    this.dataSources = {}
    this.constructors = {}
    this.schemas = {}
    this.repos = {}
    this.services = {}
    this.dynamicRepos = []

    if (this.config.constructors) {
      this.addConstructors(this.config.constructors)
    }
    if (this.config.schemas) {
      this.addSchemas(this.config.schemas)
    }
    if (this.config.repos) {
      this.addRepos(this.config.repos)
    }
    if (this.config.services) {
      this.addServices(this.config.services)
    }
  }

  setLogger(logger) {
    this.logger = logger
  }

  addInitialiser(initialiser, stage?: string) {
    stage = stage ? stage : 'default'
    if (this.initialisers[stage] === undefined) {
      this.initialisers[stage] = []
    }
    this.initialisers[stage].push(initialiser)
  }

  addInitialisers(initialisers, stage?: string) {
    initialisers.forEach((initialiser) => {
      this.addInitialiser(initialiser, stage)
    })
  }

  async runInitialisers(stage?: string) {
    stage = stage ? stage : 'default'
    if (this.initialisers[stage]) {
      for (var initFunction of this.initialisers[stage]) {
        var shutdownHandler = await Promise.resolve(initFunction(this))
        this.addShutdownHandler(shutdownHandler, stage)
      }
    }
  }

  addShutdownHandler(handler, stage?: string) {
    if (handler) {
      stage = stage ? stage : 'default'
      if (this.shutdownHandlers[stage] == undefined) {
        this.shutdownHandlers[stage] = []
      }
      this.shutdownHandlers[stage].unshift(handler)
    }
  }

  addShutdownHandlers(handlers, stage?: string) {
    handlers.forEach((handler) => {
      this.addShutdownHandler(handler, stage)
    })
  }

  async runShutdownHandlers(stage?: string) {
    stage = stage ? stage : 'default'
    if (this.shutdownHandlers[stage]) {
      for (var handler of this.shutdownHandlers[stage]) {
        await Promise.resolve(handler())
      }
    }
  }

  async initDataSourceFromConfig(options) {
    switch (options.type) {
      case 'mysql':
        return await this.initDataSource(
          options.name,
          new DataSourceMysql(options.config)
        )
        break
      case 'mongodb':
        return await this.initDataSource(
          options.name,
          new DataSourceMongodb(options.config)
        )
        break
      case 'mock':
        return await this.initDataSource(
          options.name,
          new DataSourceMock(options.data ? options.data : {})
        )
        break
      case 'dynamic':
        // Create placeholder datasource - doesn't connect
        const ds = new DataSourceDynamic(options.config || {})
        this.addDataSource(options.name, ds)
        this.logger.log(
          `[ModelManager] Created DynamicDataSource placeholder: ${options.name}`
        )
        return ds
        break
    }
  }

  async initDataSource(name: string, dataSource) {
    const waitMs = 500
    const maxAttempts = 3
    let attempt = 0
    const attemptConnect = async () => {
      attempt++
      try {
        await dataSource.connect()
        this.addDataSource(name, dataSource)
      } catch (error) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) =>
            setTimeout(() => resolve(attemptConnect()), waitMs)
          )
        } else {
          throw error
        }
      }
    }
    await attemptConnect()

    return dataSource
  }

  getRepoPopulator(): RepoPopulator {
    return this.repoPopulator
      ? this.repoPopulator
      : (this.repoPopulator = new RepoPopulator())
  }

  setRepoPopulator(repoPopulator: RepoPopulator) {
    this.repoPopulator = repoPopulator
  }

  getDataSource(name) {
    return this.dataSources[name]
  }

  /**
   * Get a datasource with dynamic resolution support.
   * Supports both static and dynamic datasource modes.
   *
   * @param key - Datasource name or lookup key
   * @param context - Optional context for dynamic resolution
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
    if (entry?.lookupKey && this.dataSourceRegistry && this.dataSourceLookup) {
      try {
        const registryKey = `${key}:${entry.lookupKey}`
        const dataSource = await this.dataSourceRegistry.getOrCreate(
          registryKey,
          async () => {
            const details = await this.dataSourceLookup!.lookup(
              key,
              entry.lookupKey!
            )
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

  addDataSource(name, dataSource: any) {
    this.dataSources[name] = dataSource
  }

  /**
   * Set the datasource lookup implementation
   *
   * @param lookup - DataSourceLookup implementation
   */
  setDataSourceLookup(lookup: DataSourceLookup) {
    this.dataSourceLookup = lookup
  }

  addConstructor(value) {
    this.constructors[value.name] = value
  }

  getConstructor(constructorName) {
    return this.constructors[constructorName]
  }

  addConstructors(constructors) {
    // could be an array of constructor functions or a object map
    var constructorsArray = Array.isArray(constructors)
      ? constructors
      : Object.values(constructors)
    constructorsArray.forEach((construct) => this.addConstructor(construct))
  }

  addSchema(schema: Schema) {
    this.schemas[schema.getName()] = schema
  }

  getSchema(name): Schema {
    return this.schemas[name]
  }

  addSchemas(schemas: Array<Schema> | { [key: string]: Schema }) {
    // could be an array of schema objects functions or a object map
    var schemasArray = Array.isArray(schemas) ? schemas : Object.values(schemas)
    schemasArray.forEach((schema) => this.addSchema(schema))
  }

  addRepo<T>(repo: Repo<T>) {
    this.repos[repo.getName()] = repo
  }

  getRepo<T>(name): Repo<T> {
    return this.repos[name]
  }

  addRepos(repos: Array<Repo<any>> | { [key: string]: Repo<any> }) {
    // could be an array of repo objects or a object map
    var reopsArray = Array.isArray(repos) ? repos : Object.values(repos)
    reopsArray.forEach((repo) => this.addRepo(repo))
  }

  addService(service: Service) {
    this.services[service.getName()] = service
  }

  getService(name): Service {
    return this.services[name]
  }

  addServices(services: Array<Service> | { [key: string]: Service }) {
    // could be an array of repo objects or a object map
    var servicesArray = Array.isArray(services)
      ? services
      : Object.values(services)
    servicesArray.forEach((service) => this.addService(service))
  }

  async loadDataSources() {
    let promises: Promise<DataSourceInterface>[] = []
    this.config.dataSources?.forEach((dataSource) => {
      promises.push(this.initDataSourceFromConfig(dataSource))
    })
    await Promise.all(promises)
    return this
  }

  async initSchemas() {
    Object.values(this.schemas).forEach((schema) => {
      schema.addSchemas(this.schemas)
      schema.addConstructors(this.constructors)
    })
  }

  async initRepos() {
    const dataSourceNames = Object.keys(this.dataSources)
    // Find first non-dynamic datasource as default
    const defaultDataSourceName = dataSourceNames.find(
      (name) => !this.dataSources[name].isDynamic?.()
    )

    var promises: Promise<void>[] = []
    Object.values(this.repos).forEach(async (repo) => {
      // We inject the main config object into every repo so it can access global config values
      repo.config.model = this.config
      repo.setLogger(this.logger)
      repo.setPopulator(this.getRepoPopulator())
      repo.addConstructors(this.constructors)
      repo.addSchemas(this.schemas)
      repo.addRepos(this.repos)
      repo.addServices(this.services)

      // Inject ModelManager reference for dynamic datasource resolution
      repo.setModelManager(this)

      // Data sources are injected into repos
      if (
        repo.config.dataSource !== undefined &&
        this.dataSources[repo.config.dataSource]
      ) {
        repo.dataSource = this.dataSources[repo.config.dataSource]

        // Skip initialization for dynamic datasources
        if (repo.dataSource.isDynamic?.()) {
          this.dynamicRepos.push(repo.getName())
          this.logger.log(
            `[ModelManager] Skipped initialization for dynamic repo: ${repo.getName()}`
          )
          return
        }
      } else if (defaultDataSourceName !== undefined) {
        repo.dataSource = this.dataSources[defaultDataSourceName]
      }

      promises.push(repo.init())
    })
    return await Promise.all(promises)
  }

  async initServices() {
    var promises: Promise<void>[] = []
    Object.values(this.services).forEach(async (service) => {
      // We inject the main config object into every service so it can access global config values
      service.config.model = this.config
      service.setLogger(this.logger)
      service.addRepos(this.repos)
      service.addServices(this.services)

      // Inject ModelManager reference for dynamic datasource initialization
      service.setModelManager(this)

      promises.push(service.init())
    })
    return await Promise.all(promises)
  }

  /**
   * Initialize a single dynamic repo by creating its indexes on the resolved datasource
   *
   * @param repoName - Name of the repo to initialize
   * @param context - DataSourceContext with lookupKey for datasource resolution
   */
  async initDynamicRepo(
    repoName: string,
    context: DataSourceContext
  ): Promise<void> {
    const repo = this.repos[repoName]
    if (!repo) {
      throw new Error(`Repo not found: ${repoName}`)
    }

    // Resolve entry for this repo's datasource
    const entry = context.getForDataSource(repo.config.dataSource)

    // Get the actual datasource using resolved entry
    const actualDS = await this.getDataSourceDynamic(
      repo.config.dataSource,
      entry
    )

    // Create indexes on the resolved datasource
    if (repo.config.indexes) {
      for (let indexName in repo.config.indexes) {
        const index = repo.config.indexes[indexName]
        await actualDS.createIndex(
          repo.config.collectionName,
          index.spec,
          index.options
        )
      }
    }

    this.logger.log(
      `[ModelManager] Initialized dynamic repo: ${repoName} for datasource: ${repo.config.dataSource}`
    )
  }

  /**
   * Initialize all dynamic repos for a specific datasource name
   *
   * @param dsName - Name of the dynamic datasource (e.g., 'project')
   * @param context - DataSourceContext with lookupKey for datasource resolution
   */
  async initDynamicReposForDataSource(
    dsName: string,
    context: DataSourceContext
  ): Promise<void> {
    const repos = Object.values(this.repos).filter(
      (r) => r.config.dataSource === dsName && r.dataSource?.isDynamic?.()
    )

    this.logger.log(
      `[ModelManager] Initializing ${repos.length} dynamic repos for datasource: ${dsName}`
    )

    for (const repo of repos) {
      await this.initDynamicRepo(repo.getName(), context)
    }

    this.logger.log(
      `[ModelManager] Initialized ${repos.length} dynamic repos for datasource: ${dsName}`
    )
  }

  async init() {
    if (!this.initialised) {
      await this.runInitialisers()
      await this.runInitialisers('00-init')
      await this.loadDataSources()

      // Initialize dynamic datasource registry if enabled
      if (this.config.enableDynamicDataSources) {
        this.dataSourceRegistry = new DataSourceRegistry({
          ...this.config.dataSourceRegistryConfig,
          logger: this.logger,
        })
        this.logger.log('[ModelManager] Dynamic datasources enabled')
      }

      await this.initSchemas()
      await this.initRepos()
      await this.initServices()
      await this.runInitialisers('99-final')
      this.initialised = true
    }

    return this
  }

  async shutdown() {
    // Should down should be in reverse order of init
    await this.runShutdownHandlers('99-final')

    // Close dynamic datasource registry
    if (this.dataSourceRegistry) {
      await this.dataSourceRegistry.close()
    }

    // Close static datasources
    let promises: Promise<void>[] = []
    Object.values(this.dataSources).forEach(async (dataSource) => {
      promises.push(dataSource.close())
    })
    await Promise.all(promises)

    await this.runShutdownHandlers('00-init')
    await this.runShutdownHandlers()

    return this
  }
}

export default ModelManager
