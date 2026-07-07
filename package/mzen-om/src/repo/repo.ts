import clone = require('clone')
import { ModelManagerConfig, Logger } from 'model-manager'
import { DataSourceContext } from 'data-source/context'
import {
  DataSourceInterface,
  QuerySelection,
  QuerySelectionOptions,
  QueryUpdate,
  QueryPersistResult,
  QueryPersistResultInsertMany,
  QueryPersistResultInsertOne,
  QueryPersistResultUpsert,
  QueryPersistResultBulk,
  BulkWriteOp,
  IndexSpec,
} from 'data-source/interface'
import Schema, {
  SchemaValidationResult,
  SchemaSpec,
  ObjectPathAccessor,
} from 'mzen-schema'
import Service from 'service'
import { RepoPopulator, RepoRelationConfig } from 'repo/populator'
import { RepoErrorValidation } from './error'
import { RepoIndexConfig } from './index-config'
import { RepoQueryOptions } from './query-options'

export interface RepoConfig {
  model?: ModelManagerConfig
  pkey?: string
  name?: string
  dataSource?: string
  collectionName?: string
  schema?: Schema | SchemaSpec
  indexes?: { [key: string]: RepoIndexConfig } | Array<RepoIndexConfig>
  autoIndex?: boolean
  relations?: { [key: string]: RepoRelationConfig }
  populator?: RepoPopulator
  constructors?: { [key: string]: Function } | Array<Function>
  schemas?: { [key: string]: Schema } | Array<Schema>
  repos?: { [key: string]: Repo<any> } | Array<Repo<any>>
  services?: { [key: string]: Service } | Array<Service>
}

export class Repo<T> {
  initialised: boolean
  config: RepoConfig
  name: string
  dataSource?: DataSourceInterface
  schema?: Schema
  populator?: RepoPopulator
  schemas: Record<string, Schema | any>
  repos: Record<string, Repo<any>>
  constructors: Record<string, Function>
  services: Record<string, Service>
  relationPaths: Array<string>
  logger: Logger
  modelManager?: any // ModelManager instance for dynamic datasource resolution

  constructor(options?: RepoConfig) {
    this.initialised = false

    this.config = options ? options : {}
    this.config.model = this.config.model ? this.config.model : {} // The main config is injected here
    this.config.pkey = this.config.pkey ? this.config.pkey : '_id'
    this.config.name = this.config.name ? this.config.name : ''
    this.config.dataSource = this.config.dataSource
      ? this.config.dataSource
      : ''
    this.config.collectionName = this.config.collectionName
      ? this.config.collectionName
      : this.config.name
    this.config.schema = this.config.schema ? this.config.schema : {}
    this.config.indexes = this.config.indexes ? this.config.indexes : []
    this.config.autoIndex =
      this.config.autoIndex !== undefined ? this.config.autoIndex : true
    this.config.relations = this.config.relations ? this.config.relations : {}
    this.config.schemas = this.config.schemas ? this.config.schemas : {}
    this.config.repos = this.config.repos ? this.config.repos : {}
    this.config.constructors = this.config.constructors
      ? this.config.constructors
      : {}
    this.config.services = this.config.services ? this.config.services : {}

    this.logger = console

    this.name = this.config.name ? this.config.name : this.constructor.name

    this.populator = this.config.populator

    this.schemas = {}
    this.repos = {}
    this.constructors = {}
    this.services = {}

    if (this.config.schemas) this.addSchemas(this.config.schemas)
    if (this.config.repos) this.addRepos(this.config.repos)
    if (this.config.constructors) this.addConstructors(this.config.constructors)
    if (this.config.services) this.addServices(this.config.services)

    // Compile an array of relation aliases which can be used to strip relations of populated docs before saving
    this.relationPaths = []
    this.compileRelationPaths()
  }

  setLogger<T extends Logger>(logger: T) {
    this.logger = logger
  }

  // Init creates indexes
  async init() {
    if (!this.initialised) {
      var promises: Promise<any>[] = []
      if (!this.schema) {
        this.initSchema()
        if (this.config.autoIndex && this.hasIndexes())
          promises.push(this.createIndexes())
      }
      await Promise.all(promises)
      this.initialised = true
    }
  }

  compileRelationPaths() {
    const relations =
      typeof this.config.relations == 'object' ? this.config.relations : {}
    Object.keys(relations).forEach((alias) => {
      if (typeof this.config.relations == 'object') {
        let relation = this.config.relations[alias]
        // set 'alias' in the relation config if not set
        // - the alias name is usually defined by the relation config as a the config element key but the alias value
        // - needs to be available within the relation config itself so it can be passed around
        if (relation.alias == undefined)
          this.config.relations[alias].alias = alias
        let docPath = relation.docPath ? relation.docPath : null
        let aliasPath = docPath
          ? docPath + '.' + relation.alias
          : relation.alias
        if (aliasPath !== undefined) {
          this.relationPaths.push(aliasPath)
        }
      }
    })
  }

  initSchema() {
    if (!this.schema) {
      const repoName =
        this.config.name != undefined ? this.config.name : this.constructor.name
      if (this.config.schema instanceof Schema) {
        this.schema = this.config.schema
      } else if (this.config.schema && Object.keys(this.config.schema).length) {
        this.schema = new Schema(this.config.schema)
      } else if (this.schemas[repoName]) {
        // If schema is not specified explicitly use the schema with the same name from the schema list
        this.schema = this.schemas[repoName]
      } else {
        // No schema defined - use empty schema
        this.schema = new Schema()
      }
      if (this.schema) {
        this.schema.addConstructors(this.constructors)
        this.schema.addSchemas(this.schemas)
      }
    }
  }

  getName(): string {
    // If repo name == 'Repo' then we are most likely using the name of the default repo constructor.
    // This can cause problems because repositories are referred to by name in the model and if we have multiple
    // repositories named 'Repo' we could not be sure which one we are working with
    // For this reason we do not permit a repository to be named 'Repo'
    if (this.name == 'Repo')
      throw new Error(
        'Repo name not configured - ' +
          'you must specify a repo name when using the default repo constructor'
      )
    return this.name
  }

  getPopulator() {
    return this.populator
      ? this.populator
      : (this.populator = new RepoPopulator())
  }

  setPopulator(populator: RepoPopulator) {
    this.populator = populator
  }

  setModelManager(modelManager: any) {
    this.modelManager = modelManager
  }

  addConstructor<T extends Function>(value: T) {
    this.constructors[value.name] = value
  }

  getConstructor(constructorName: string): Function | null {
    return this.constructors[constructorName]
      ? this.constructors[constructorName]
      : null
  }

  addConstructors<T extends Function>(
    constructors: Array<T> | Record<string, T>
  ) {
    // could be an array of constructor functions or a object map
    var constructorsArray = Array.isArray(constructors)
      ? constructors
      : Object.values(constructors)
    constructorsArray.forEach((construct) => this.addConstructor(construct))
  }

  addSchema<T extends Schema>(schema: T) {
    this.schemas[schema.getName()] = schema
  }

  getSchema<T extends Schema>(name: string): T | null {
    return this.schemas[name] ? this.schemas[name] : null
  }

  addSchemas(schemas: Array<Schema> | { [key: string]: Schema }) {
    // could be an array of schema docs functions or a object map
    var schemasArray = Array.isArray(schemas) ? schemas : Object.values(schemas)
    schemasArray.forEach((schema) => this.addSchema(schema))
  }

  addRepo<T extends Repo<any>>(repo: T) {
    this.repos[repo.getName()] = repo
  }

  getRepo<T extends Repo<any>>(name: string): T {
    return this.repos[name] as T
  }

  addRepos<T extends Object>(repos: Array<Repo<T>> | Record<string, Repo<T>>) {
    // could be an array of repo docs or a object map
    var reposArray = Array.isArray(repos) ? repos : Object.values(repos)
    reposArray.forEach((repo) => this.addRepo(repo))
  }

  addService(service: Service) {
    this.services[service.getName()] = service
  }

  getService(name): Service {
    return this.services[name]
  }

  addServices(services: Array<Service> | { [key: string]: Service }) {
    // could be an array of repo docs or a object map
    var servicesArray = Array.isArray(services)
      ? services
      : Object.values(services)
    servicesArray.forEach((service) => this.addService(service))
  }

  drop() {
    if (this.config.collectionName) {
      return this.dataSource?.drop(this.config.collectionName)
    }
  }

  /**
   * Get datasource with dynamic resolution support.
   * Resolves datasource based on config and optional context.
   *
   * @param context - Optional context for dynamic resolution
   * @returns DataSource instance
   */
  async getDataSource(
    context?: import('data-source/context').DataSourceContext
  ): Promise<DataSourceInterface> {
    // An active datasource (typically a transaction lease bound via transaction()) always
    // takes precedence - this is what lets every nested repo.xxx({ context }) call within one
    // transaction resolve the same lease, bypassing the registry entirely and with no extra
    // ref-count churn.
    const activeDataSource = context?.getActiveDataSource?.(
      this.config.dataSource
    )
    if (activeDataSource) {
      return activeDataSource
    }

    const isDynamic = this.dataSource?.isDynamic?.()

    // Static route: not a dynamic datasource
    if (!isDynamic) {
      if (this.dataSource) {
        return this.dataSource
      }
      throw new Error(
        `No static datasource configured for repo: ${this.getName()}`
      )
    }

    // Dynamic route: datasource is dynamic
    if (!this.modelManager) {
      throw new Error(
        `ModelManager not set for dynamic datasource resolution in repo: ${this.getName()}`
      )
    }

    // Get context entry for this specific datasource
    const dataSourceName = this.config.dataSource
    const entry = context?.getForDataSource(dataSourceName)

    if (!entry?.lookupKey && !entry?.dataSourceKey) {
      throw new Error(
        `No datasource context provided for dynamic repo: ${this.getName()}. ` +
          `Provide context with lookupKey or dataSourceKey in query options.`
      )
    }

    return await this.modelManager.getDataSourceDynamic(dataSourceName, entry)
  }

  /**
   * Release a registry reference acquired via getDataSource(), if this repo's datasource is
   * dynamic. Safe to call unconditionally after every CRUD call and from transaction()'s
   * cleanup - it is a no-op for static (non-registry) datasources.
   */
  releaseDataSource(
    context?: import('data-source/context').DataSourceContext
  ): void {
    if (!this.dataSource?.isDynamic?.()) return
    const lookupKey = context?.getForDataSource?.(
      this.config.dataSource
    )?.lookupKey
    if (lookupKey) {
      this.modelManager?.dataSourceRegistry?.release(
        `${this.config.dataSource}:${lookupKey}`
      )
    }
  }

  /**
   * Runs `fn` inside a transaction on this repo's datasource, handling the full
   * acquire/lease/release/commit/rollback sequence in one place so no call site has to hand-roll
   * it:
   *
   * 1. Acquires the initial registry ref via getDataSource(context).
   * 2. Calls transactionStart() on it to obtain an exclusive lease, and derives a new context
   *    with that lease bound via context.withActiveDataSource() - the caller's own `context` is
   *    never mutated. `fn` is given this new context so every nested repo.xxx({ context }) call
   *    inside `fn` resolves the same lease (see getDataSource()), as long as it uses the context
   *    passed to `fn` rather than the outer one.
   * 3. Runs fn(txContext, lease).
   * 4. Commits on success; rolls back and rethrows on error.
   * 5. Always releases the initial registry ref in a finally block - regardless of whether
   *    fn/commit/rollback threw.
   */
  async transaction<R>(
    context: DataSourceContext,
    fn: (context: DataSourceContext, tx: DataSourceInterface) => Promise<R>
  ): Promise<R> {
    if (!this.config.dataSource) {
      throw new Error(`No dataSource configured for repo: ${this.getName()}`)
    }
    const dataSourceName = this.config.dataSource

    const dataSource = await this.getDataSource(context)

    try {
      const lease = await dataSource.transactionStart()
      const txContext = context.withActiveDataSource(dataSourceName, lease)

      try {
        const result = await fn(txContext, lease)
        await lease.transactionCommit()
        return result
      } catch (error) {
        await lease.transactionRollback()
        throw error
      }
    } finally {
      this.releaseDataSource(context)
    }
  }

  async reset() {
    // This method drops the collection and re-creates it with indexes if any are defined
    await this.drop()
    if (this.config.autoIndex && this.hasIndexes()) {
      await this.createIndexes()
    }
  }

  hasIndexes(): boolean {
    return !!this.config.indexes && Object.keys(this.config.indexes).length > 0
  }

  async createIndexes() {
    if (!this.hasIndexes()) {
      throw new Error(
        `Repo "${this.config.collectionName}" has no indexes configured`
      )
    }
    for (let indexName in this.config.indexes) {
      var index = this.config.indexes[indexName]
      if (index.options == undefined) index.options = {}
      if (index.name) {
        index.options.name = index.name
      } else {
        index.options.name = indexName
      }
      await this.createIndex(index.spec, index.options)
    }
    return true
  }

  async createIndex(fieldOrSpec: IndexSpec | string, options?) {
    if (this.dataSource == undefined) {
      throw new Error('No data source provided')
    }
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }
    return this.dataSource.createIndex(
      this.config.collectionName,
      fieldOrSpec,
      options
    )
  }

  async dropIndex(indexName: string, _options?) {
    if (this.dataSource == undefined) {
      throw new Error('No data source provided')
    }
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }
    return this.dataSource.dropIndex(this.config.collectionName, indexName)
  }

  async dropIndexes() {
    if (this.dataSource == undefined) {
      throw new Error('No data source provided')
    }
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }
    return this.dataSource.dropIndexes(this.config.collectionName)
  }

  async find(query?: QuerySelection, options?: RepoQueryOptions): Promise<T[]> {
    this.initSchema()

    if (this.schema == undefined) {
      throw new Error('No data schema initialised')
    }
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const optionsAll = this.normalizeFindOptions(options ? options : {})
    const optionsPropagate = this.getPropagateOptions(optionsAll)
    const optionsQuery = this.getQueryOptions(optionsAll)

    query = query ? query : {}
    let errors = await this.validateQuery(query, options)
    if (errors) throw new RepoErrorValidation(errors)

    var docs = await dataSource.find(
      this.config.collectionName,
      query,
      optionsQuery
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return this.findPopulate(docs, optionsPropagate)
  }

  async findOne(
    query?: QuerySelection,
    options?: RepoQueryOptions
  ): Promise<T> {
    this.initSchema()

    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const optionsAll = this.normalizeFindOptions(options ? options : {})
    const optionsPropagate = this.getPropagateOptions(optionsAll)
    const optionsQuery = this.getQueryOptions(optionsAll)

    query = query ? query : {}
    let errors = await this.validateQuery(query, options)
    if (errors) throw new RepoErrorValidation(errors)

    var docs = await dataSource.findOne(
      this.config.collectionName,
      query,
      optionsQuery
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return this.findPopulate(docs, optionsPropagate)
  }

  async count(
    query?: QuerySelection,
    options?: RepoQueryOptions
  ): Promise<number> {
    this.initSchema()

    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    query = query ? query : {}
    let errors = await this.validateQuery(query, options)
    if (errors) throw new RepoErrorValidation(errors)

    const result = await dataSource.count(
      this.config.collectionName,
      query,
      options
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async groupCount(
    groupFields: string[],
    query?: QuerySelection,
    options?: RepoQueryOptions
  ): Promise<Array<{ _id: any; count: number }>> {
    this.initSchema()

    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    query = query ? query : {}
    const result = await dataSource.groupCount(
      this.config.collectionName,
      groupFields,
      query
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async findGroup(
    groupFields: string[],
    query?: QuerySelection,
    options?: RepoQueryOptions
  ) {
    this.initSchema()

    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    query = query ? query : {}
    const result = await dataSource.findGroup(
      this.config.collectionName,
      groupFields,
      query
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  private normalizeFindOptions(options: RepoQueryOptions) {
    var options = options ? { ...options } : {}
    options.skipValidation =
      options.skipValidation !== undefined ? options.skipValidation : false
    options.filterPrivate =
      options.filterPrivate !== undefined ? options.filterPrivate : false
    options.populate =
      options.populate !== undefined ? options.populate : undefined
    return options
  }

  private getQueryOptions(options) {
    var queryOptions: QuerySelectionOptions = options ? { ...options } : {}
    if (queryOptions.filterPrivate !== undefined)
      delete queryOptions.filterPrivate
    if (queryOptions.populate !== undefined) delete queryOptions.populate
    return queryOptions
  }

  private getPropagateOptions(options) {
    // Get find options that should propagate (with query options removed)
    options = options ? options : {}
    return {
      filterPrivate: options.filterPrivate,
      populate: options.populate,
      context: options.context,
    }
  }

  private async findPopulate(docs: any, options: any) {
    if (options.filterPrivate && this.schema) {
      docs = this.schema.filterPrivate(docs, 'read')
    }
    docs = docs && this.schema ? this.schema.applyTransients(docs) : docs
    if (docs && this.schema) {
      docs = await this.schema.applyDecrypt(docs)
    }
    const populateResult =
      options.populate === false ? docs : this.populateAll(docs, options)
    return populateResult
  }

  async populateAll(docs: Partial<T>[], options?: RepoQueryOptions) {
    return this.getPopulator().populateAll(this, docs, options)
  }

  async populate(
    relation: RepoRelationConfig | string,
    docs?: Partial<T>[],
    options?: RepoQueryOptions
  ) {
    return this.getPopulator().populate(this, relation, docs, options)
  }

  async insertMany(
    docs: Partial<T>[],
    options?
  ): Promise<QueryPersistResultInsertMany> {
    this.initSchema()

    if (this.schema == undefined) {
      throw new Error('No schema provided')
    }
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    docs = Array.prototype.slice.call(docs) // We use Array.slice() to make a copy of the original args
    docs = this.stripTransients(docs)

    if (options && options.filterPrivate) {
      docs = this.schema.filterPrivate(docs, 'write')
    }

    docs = await this.schema.applyEncrypt(docs)

    var validateResult = await this.schema.validate(docs)
    if (!validateResult.isValid) {
      throw new RepoErrorValidation(validateResult.errors)
    }

    const result = await dataSource.insertMany(
      this.config.collectionName,
      docs,
      options
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async insertOne(
    doc: Partial<T>,
    options?
  ): Promise<QueryPersistResultInsertOne> {
    this.initSchema()

    if (this.schema == undefined) {
      throw new Error('No schema provided')
    }
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    doc = await this._insertOnePrepare(doc, options)

    const result = await dataSource.insertOne(
      this.config.collectionName,
      doc,
      options
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async _insertOnePrepare(doc: Partial<T>, options?): Promise<Partial<T>> {
    this.initSchema()
    if (this.schema == undefined) {
      throw new Error('No schema provided')
    }

    doc = clone(doc) // We use clone() to make a copy of the original arg
    doc = this.stripTransients(doc)

    if (options && options.filterPrivate) {
      doc = this.schema.filterPrivate(doc, 'write')
    }

    doc = await this.schema.applyEncrypt(doc)

    var validateResult = await this.schema.validate(doc)
    if (!validateResult.isValid) {
      throw new RepoErrorValidation(validateResult.errors)
    }

    return doc
  }

  async _updatePrepare(
    filter: QuerySelection,
    update: QueryUpdate,
    options?
  ): Promise<{
    f: QuerySelection
    u: QueryUpdate
    o?
  }> {
    this.initSchema()
    filter = clone(filter)
    update = clone(update)
    var promises: Promise<SchemaValidationResult>[] = []
    var validateResult = {} as SchemaValidationResult
    var validateResultQuery = {}
    var validateResultUpdate = {}
    filter = filter ? filter : {}

    if (update && update.$set) {
      update.$set = this.stripTransients(
        update.$set as Partial<T>,
        'iteratePaths'
      )
      if (options?.filterPrivate && this.schema) {
        update.$set = this.schema.filterPrivate(
          update.$set,
          'write',
          'iteratePaths'
        )
      }
    }

    if (update && update.$setOnInsert) {
      update.$setOnInsert = this.stripTransients(
        update.$setOnInsert as Partial<T>,
        'iteratePaths'
      )
      if (options?.filterPrivate && this.schema) {
        update.$setOnInsert = this.schema.filterPrivate(
          update.$setOnInsert,
          'write',
          'iteratePaths'
        )
      }
    }

    if (this.schema) {
      if (update && update.$set) {
        update.$set = await this.schema.applyEncryptPaths(
          update.$set as Record<string, any>
        )
      }
      if (update && update.$setOnInsert) {
        update.$setOnInsert = await this.schema.applyEncryptPaths(
          update.$setOnInsert as Record<string, any>
        )
      }
      promises.push(
        this.schema.validateQuery(filter).then((result) => {
          return (validateResultQuery = result)
        })
      )
      if (update && update.$set) {
        promises.push(
          this.schema.validatePaths(update.$set).then((result) => {
            return (validateResultUpdate = result)
          })
        )
      }
      if (update && update.$setOnInsert) {
        promises.push(
          this.schema.validatePaths(update.$setOnInsert).then((result) => {
            validateResultUpdate = Schema.mergeValidationResults([
              validateResultUpdate,
              result,
            ])
            return validateResultUpdate
          })
        )
      }
    }

    await Promise.all(promises)
    validateResult = Schema.mergeValidationResults([
      validateResultQuery,
      validateResultUpdate,
    ])
    if (!validateResult.isValid) {
      throw new RepoErrorValidation(validateResult.errors)
    }

    return {
      f: filter,
      u: update,
      o: options,
    }
  }

  async updateMany(
    filter: QuerySelection,
    update: QueryUpdate,
    options?
  ): Promise<QueryPersistResult> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const { f, u, o } = await this._updatePrepare(filter, update, options)
    const result = await dataSource.updateMany(
      this.config.collectionName,
      f,
      u,
      o
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async updateOne(
    filter: QuerySelection,
    update: QueryUpdate,
    options?
  ): Promise<QueryPersistResult> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const { f, u, o } = await this._updatePrepare(filter, update, options)
    const result = await dataSource.updateOne(
      this.config.collectionName,
      f,
      u,
      o
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async upsertMany(
    filter: QuerySelection,
    update: QueryUpdate,
    options?
  ): Promise<QueryPersistResultUpsert> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    const dataSource = await this.getDataSource(options?.context)

    const { f, u, o } = await this._updatePrepare(filter, update, options)
    const result = await dataSource.upsertMany(
      this.config.collectionName,
      f,
      u,
      o
    )

    this.releaseDataSource(options?.context)

    return result
  }

  async upsertOne(
    filter: QuerySelection,
    update: QueryUpdate,
    options?
  ): Promise<QueryPersistResultUpsert> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    const dataSource = await this.getDataSource(options?.context)

    const { f, u, o } = await this._updatePrepare(filter, update, options)
    const result = await dataSource.upsertOne(
      this.config.collectionName,
      f,
      u,
      o
    )

    this.releaseDataSource(options?.context)

    return result
  }

  async _deletePrepare(
    filter: QuerySelection,
    options?
  ): Promise<{ f: QuerySelection; o? }> {
    this.initSchema()
    options = options ? options : {}
    filter = filter ? filter : {}
    if (this.schema) {
      var validateResult = await this.schema.validateQuery(filter)
      if (!validateResult.isValid) {
        let error = new RepoErrorValidation(
          'One or more fields failed validation'
        )
        error.validationErrors = validateResult.errors
        throw error
      }
    }
    return {
      f: filter,
      o: options,
    }
  }

  async deleteMany(
    filter: QuerySelection,
    options?
  ): Promise<QueryPersistResult> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const { f, o } = await this._deletePrepare(filter, options)
    const result = await dataSource.deleteMany(this.config.collectionName, f, o)

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async deleteOne(
    filter: QuerySelection,
    options?
  ): Promise<QueryPersistResult> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const { f, o } = await this._deletePrepare(filter, options)
    const result = await dataSource.deleteOne(this.config.collectionName, f, o)

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async _bulkWritePrepare(
    ops: BulkWriteOp<Partial<T>>[],
    options?
  ): Promise<BulkWriteOp[]> {
    const preparedOps: BulkWriteOp[] = []
    // Sequential loop: each _prepare helper throws as soon as its own op fails validation, so
    // the first invalid op (by array index) stops the loop before any later op is even prepared
    // and before dataSource.bulkWrite is ever called - stronger than "first DB-level failure
    // rolls back" since no partial DB work happens on a validation failure at all.
    for (const op of ops) {
      if ('insertOne' in op) {
        const document = await this._insertOnePrepare(
          op.insertOne.document,
          options
        )
        preparedOps.push({ insertOne: { document } })
      } else if ('updateOne' in op) {
        const { f, u } = await this._updatePrepare(
          op.updateOne.filter,
          op.updateOne.update,
          options
        )
        preparedOps.push({ updateOne: { filter: f, update: u } })
      } else if ('updateMany' in op) {
        const { f, u } = await this._updatePrepare(
          op.updateMany.filter,
          op.updateMany.update,
          options
        )
        preparedOps.push({ updateMany: { filter: f, update: u } })
      } else if ('deleteOne' in op) {
        const { f } = await this._deletePrepare(op.deleteOne.filter, options)
        preparedOps.push({ deleteOne: { filter: f } })
      } else if ('deleteMany' in op) {
        const { f } = await this._deletePrepare(op.deleteMany.filter, options)
        preparedOps.push({ deleteMany: { filter: f } })
      } else {
        throw new Error('Unsupported bulkWrite operation')
      }
    }
    return preparedOps
  }

  async bulkWrite(
    ops: BulkWriteOp<Partial<T>>[],
    options?
  ): Promise<QueryPersistResultBulk> {
    if (this.config.collectionName == undefined) {
      throw new Error('No collection name provided')
    }

    // Resolve datasource (with dynamic support)
    const dataSource = await this.getDataSource(options?.context)

    const preparedOps = await this._bulkWritePrepare(ops, options)

    const result = await dataSource.bulkWrite(
      this.config.collectionName,
      preparedOps,
      options
    )

    // Release registry ref acquired via getDataSource(), if any
    this.releaseDataSource(options?.context)

    return result
  }

  async validateQuery(query?: QuerySelection, options?: RepoQueryOptions) {
    let errors
    query = query ? query : {}

    const optionsAll = this.normalizeFindOptions(options ? options : {})
    if (!optionsAll.skipValidation && this.schema) {
      const validateResult = await this.schema.validateQuery(query)
      if (!validateResult.isValid) {
        errors = validateResult.errors
      }
    }

    return errors
  }

  stripTransients(docs: Partial<T> | Partial<T>[], iteratorType?: string) {
    this.initSchema()

    if (this.schema) {
      iteratorType = iteratorType == 'iteratePaths' ? 'iteratePaths' : 'iterate'

      var newdocs = clone(docs) // We will be deleting relations so we need to work on a copy
      var isArray = Array.isArray(newdocs)
      var newdocs = isArray ? newdocs : [newdocs]

      this.relationPaths.forEach(function (relationPath) {
        ObjectPathAccessor.unsetPath('*.' + relationPath, newdocs)
      })

      newdocs = this.schema.stripTransients(newdocs, iteratorType)

      return isArray ? newdocs : newdocs.pop()
    }

    return docs
  }
}
