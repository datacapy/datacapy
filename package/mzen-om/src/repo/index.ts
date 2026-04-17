import clone = require('clone')
import { ModelManagerConfig, Logger } from 'model-manager'
import {
  DataSourceInterface,
  QuerySelection,
  QuerySelectionOptions,
  QueryUpdate,
  QueryPersistResult,
  QueryPersistResultInsertMany,
  QueryPersistResultInsertOne,
  IndexSpec,
  IndexOptions,
  TypeHintValue,
} from 'data-source/interface'
import { DataSourceContext } from 'data-source/context'
import Schema, {
  SchemaValidationResult,
  SchemaSpec,
  ObjectPathAccessor,
} from 'mzen-schema'
import Service from 'service'
import { RepoPopulator, RepoRelationConfig } from 'repo/populator'

export class RepoErrorValidation extends Error {
  validationErrors: any

  constructor(errors) {
    const errorPaths = errors ? Object.keys(errors) : []
    const errorPathsString = errorPaths.length
      ? ' (' + errorPaths.join(', ') + ')'
      : ''
    super('One or more fields' + errorPathsString + ' failed validation')
    this.validationErrors = errors
  }
}

export const TYPE_HINT_STRING: TypeHintValue = 'string'
export const TYPE_HINT_INT: TypeHintValue = 'int'
export const TYPE_HINT_DECIMAL: TypeHintValue = 'decimal'
export const TYPE_HINT_DATE: TypeHintValue = 'date'
export const TYPE_HINT_DATETIME: TypeHintValue = 'datetime'
export const TYPE_HINT_TIMESTAMP: TypeHintValue = 'timestamp'

export { TypeHintValue }

export interface RepoIndexConfig {
  // fieldname or {fieldA: 1, fieldB: -1} or {location: '2dsphere', description: 'text', otherField: 1}
  spec: { [key: string]: number | string } | string
  // boolean options indicates unique index; object-form typeHint maps per-field types for composite indexes
  options?: boolean | (IndexOptions & { [key: string]: any })
}

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

export interface RepoQueryOptions extends QuerySelectionOptions {
  populate?: { [key: string]: boolean } | boolean
  filterPrivate?: boolean
  // mzen query validator can not handle complex queries
  // - some times the only option is to skip query validation
  skipValidation?: boolean
  // Context for dynamic datasource resolution
  context?: DataSourceContext
  [key: string]: any // allow implementation specific props
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
        if (this.config.autoIndex) promises.push(this.createIndexes())
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
    context?: DataSourceContext
  ): Promise<DataSourceInterface> {
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

  async reset() {
    // This method drops the collection and re-creates it with indexes if any are defined
    await this.drop()
    if (this.config.autoIndex) {
      await this.createIndexes()
    }
  }

  async createIndexes() {
    var promises: Promise<any>[] = []
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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    doc = clone(doc) // We use Array.slice() to make a copy of the original args
    doc = this.stripTransients(doc)

    if (options && options.filterPrivate) {
      doc = this.schema.filterPrivate(doc, 'write')
    }

    doc = await this.schema.applyEncrypt(doc)

    var validateResult = await this.schema.validate(doc)
    if (!validateResult.isValid) {
      throw new RepoErrorValidation(validateResult.errors)
    }

    const result = await dataSource.insertOne(
      this.config.collectionName,
      doc,
      options
    )

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

    return result
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

    if (this.schema) {
      if (update && update.$set) {
        update.$set = await this.schema.applyEncryptPaths(
          update.$set as Record<string, any>
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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

    // Release datasource reference if using registry
    if (this.dataSource?.isDynamic?.()) {
      const lookupKey = options?.context?.getForDataSource?.(
        this.config.dataSource
      )?.lookupKey
      if (lookupKey) {
        this.modelManager?.dataSourceRegistry?.release(
          `${this.config.dataSource}:${lookupKey}`
        )
      }
    }

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

export default Repo
