import {
  DataSourceInterface,
  DataSourceRegistry,
  DataSourceRegistryConfig,
  DataSourceLookup,
  DataSourceContext,
  DataSourceContextEntry,
} from 'data-source'
import DataSourceManager from 'data-source-manager'
import Repo from 'repo'
import RepoPopulator from 'repo/populator'
import Service from 'service'
import Schema from 'mzen-schema'

export interface Logger extends Console {}

export interface ModelManagerConfigDataSource {
  name?: string
  type?: 'mongodb' | 'mock' | 'mysql' | 'dynamic' | string
  config?: { [key: string]: any }
  data?: { [key: string]: any }
}

export interface ModelManagerConfig {
  dataSources?: Array<ModelManagerConfigDataSource>
  constructors?: { [key: string]: any } | Array<any>
  schemas?: { [key: string]: Schema } | Array<Schema>
  repos?: { [key: string]: Repo<any> } | Array<Repo<any>>
  services?: { [key: string]: Service } | Array<Service>
  app?: any // adhoc app configuration passed by consumers

  // Dynamic datasource configuration
  dynamicDataSource?: {
    enable?: boolean
    registry?: DataSourceRegistryConfig
  }
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
  dataSourceManager: DataSourceManager
  constructors: { [key: string]: Function }
  schemas: { [key: string]: Schema }
  repos: { [key: string]: Repo<any> }
  services: { [key: string]: Service }
  repoPopulator?: RepoPopulator
  logger: Logger

  // Delegation getters for backward compatibility
  get dataSources() {
    return this.dataSourceManager.dataSources
  }
  set dataSources(v) {
    this.dataSourceManager.dataSources = v
  }
  get dataSourceRegistry() {
    return this.dataSourceManager.dataSourceRegistry
  }
  get dataSourceLookups() {
    return this.dataSourceManager.dataSourceLookups
  }
  get dynamicRepos() {
    return this.dataSourceManager.dynamicRepos
  }

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

    this.dataSourceManager = new DataSourceManager(
      this.logger,
      this.config.dynamicDataSource?.registry,
      this.config.dynamicDataSource?.enable
    )

    this.initialised = false
    this.initialisers = {}
    this.shutdownHandlers = {}
    this.constructors = {}
    this.schemas = {}
    this.repos = {}
    this.services = {}

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
    this.dataSourceManager.logger = logger
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

  async initDataSourceFromConfig(options: ModelManagerConfigDataSource) {
    return this.dataSourceManager.initDataSourceFromConfig(options)
  }

  async initDataSource(name: string, dataSource) {
    return this.dataSourceManager.initDataSource(name, dataSource)
  }

  getRepoPopulator(): RepoPopulator {
    return this.repoPopulator
      ? this.repoPopulator
      : (this.repoPopulator = new RepoPopulator())
  }

  setRepoPopulator(repoPopulator: RepoPopulator) {
    this.repoPopulator = repoPopulator
  }

  getDataSource(name: string) {
    return this.dataSourceManager.getDataSource(name)
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
    return this.dataSourceManager.getDataSourceDynamic(key, entry)
  }

  addDataSource(name: string, dataSource: DataSourceInterface) {
    this.dataSourceManager.addDataSource(name, dataSource)
  }

  /**
   * Set the datasource lookup implementation for a specific datasource
   *
   * @param name - Datasource name (e.g., 'project')
   * @param lookup - DataSourceLookup implementation
   */
  setDataSourceLookup(name: string, lookup: DataSourceLookup) {
    this.dataSourceManager.setDataSourceLookup(name, lookup)
  }

  /**
   * Get the datasource lookup implementation for a specific datasource
   *
   * @param name - Datasource name
   * @returns DataSourceLookup implementation or undefined
   */
  getDataSourceLookup(name: string): DataSourceLookup | undefined {
    return this.dataSourceManager.getDataSourceLookup(name)
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
    await this.dataSourceManager.loadDataSources(this.config.dataSources ?? [])
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
          this.dataSourceManager.trackDynamicRepo(repo.getName())
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
    return this.dataSourceManager.initDynamicRepo(repoName, context, this.repos)
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
    return this.dataSourceManager.initDynamicReposForDataSource(
      dsName,
      context,
      this.repos
    )
  }

  async init() {
    if (!this.initialised) {
      await this.runInitialisers()
      await this.runInitialisers('00-init')
      await this.loadDataSources()

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

    await this.dataSourceManager.closeRegistry()
    await this.dataSourceManager.closeAll()

    await this.runShutdownHandlers('00-init')
    await this.runShutdownHandlers()

    return this
  }
}

export default ModelManager
