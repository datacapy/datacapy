import { SchemaIterator, SchemaIteratorMeta } from './iterator'
import SchemaConfig from './config'
import SchemaSpec from './spec'
import SchemaInquisitor from './inquisitor'
import SchemaFieldTypeCaster from './processors/field-type-caster'
import SchemaFieldFilter from './processors/field-filter'
import SchemaFieldValidator from './processors/field-validator'
import SchemaTransientProcessor from './processors/transient-processor'
import SchemaFieldPrivateFilter from './processors/field-private-filter'

export interface SchemaValidationMeta {
  errors?: any
  isValid?: boolean
}

export interface SchemaValidationResult {
  errors?: { [path: string]: string[] | { [path: string]: string[] } }
  isValid?: boolean
}

export interface SchemaPaths {
  [key: string]: any
}

export interface SchemaQuery {
  $eq?: any
  $lt?: any
  $gt?: any
  $in?: Array<any>
  $nin?: Array<any>
  $and?: SchemaQuery | Array<SchemaQuery>
  $or?: SchemaQuery | Array<SchemaQuery>
  [key: string]: SchemaQuery | Array<SchemaQuery> | any
}

export class Schema {
  config: SchemaConfig
  name: string
  spec: SchemaSpec
  constructors: { [key: string]: any }
  schemas: { [key: string]: Schema }
  schemaIterator: SchemaIterator
  private fieldTypeCaster?: SchemaFieldTypeCaster
  private fieldFilter?: SchemaFieldFilter
  private fieldValidator?: SchemaFieldValidator
  private transientProcessor?: SchemaTransientProcessor
  private fieldPrivateFilter?: SchemaFieldPrivateFilter

  constructor(spec?: SchemaSpec, options?: SchemaConfig) {
    this.config = options == undefined ? {} : options
    this.config.name = this.config.name ? this.config.name : ''
    this.config.spec = spec ? spec : {}
    this.config.constructors = this.config.constructors
      ? this.config.constructors
      : {}
    this.config.schemas = this.config.schemas ? this.config.schemas : {}

    this.name = this.config.name
      ? this.config.name
      : this.config.spec.$name
        ? this.config.spec.$name
        : this.constructor.name
    this.spec = this.config.spec ? this.config.spec : {}

    this.constructors = {}
    if (this.config.constructors) this.addConstructors(this.config.constructors)

    this.schemas = {}
    if (this.config.schemas) this.addSchemas(this.config.schemas)

    this.schemaIterator = null
  }

  init() {
    if (!this.schemaIterator) {
      this.schemaIterator = new SchemaIterator(this.spec, this.config)
      this.schemaIterator.addSchemas(this.schemas)
      this.schemaIterator.init()
    }
  }

  getName() {
    return this.name
  }

  setName(name: string) {
    this.name = name
  }

  getMapper(): SchemaIterator {
    // We need the normalised spec
    // - so we must initialise the SchemaIterator
    this.init()
    return this.schemaIterator
  }

  getSpec(): SchemaSpec {
    return this.getMapper().getSpec()
  }

  setSpec(spec: SchemaSpec) {
    this.spec = spec
  }

  getInquisitor(): SchemaInquisitor {
    return new SchemaInquisitor(this)
  }

  private getFieldTypeCaster(): SchemaFieldTypeCaster {
    if (!this.fieldTypeCaster) {
      this.fieldTypeCaster = new SchemaFieldTypeCaster()
    }
    return this.fieldTypeCaster
  }

  private getFieldFilter(): SchemaFieldFilter {
    if (!this.fieldFilter) {
      this.fieldFilter = new SchemaFieldFilter(this.getFieldTypeCaster())
    }
    return this.fieldFilter
  }

  private getFieldValidator(): SchemaFieldValidator {
    if (!this.fieldValidator) {
      this.fieldValidator = new SchemaFieldValidator(
        this.config,
        this.getFieldTypeCaster(),
        this.getFieldFilter()
      )
    }
    return this.fieldValidator
  }

  private getTransientProcessor(): SchemaTransientProcessor {
    if (!this.transientProcessor) {
      this.transientProcessor = new SchemaTransientProcessor(
        this.getFieldTypeCaster()
      )
    }
    return this.transientProcessor
  }

  private getFieldPrivateFilter(): SchemaFieldPrivateFilter {
    if (!this.fieldPrivateFilter) {
      this.fieldPrivateFilter = new SchemaFieldPrivateFilter()
    }
    return this.fieldPrivateFilter
  }

  addConstructor(value) {
    this.constructors[value.alias !== undefined ? value.alias : value.name] =
      value
  }

  getConstructor(constructorName) {
    return this.constructors[constructorName]
      ? this.constructors[constructorName]
      : null
  }

  addConstructors(constructors) {
    if (constructors) {
      // Could be an array of constructor functions or a object map
      var constructorsArray = Array.isArray(constructors)
        ? constructors
        : Object.keys(constructors).map((name) => constructors[name])
      constructorsArray.forEach((construct) => {
        if (typeof construct == 'function') this.addConstructor(construct)
      })
    }
  }

  addSchema(schema: Schema) {
    this.schemas[schema.getName()] = schema
  }

  addSchemas(schemas: Array<Schema> | { [key: string]: Schema }) {
    if (schemas) {
      // Could be an array of schema objects or a object map
      var schemasArray = Array.isArray(schemas)
        ? schemas
        : Object.keys(schemas).map((name) => schemas[name])
      schemasArray.forEach((schema) => {
        if (schema instanceof Schema) this.addSchema(schema)
      })
    }
  }

  applyTransients(object: any) {
    this.init()
    return this.getTransientProcessor().applyTransients(
      object,
      this.schemaIterator,
      this.constructors,
      this.schemas,
      this.name
    )
  }

  stripTransients(object: any, iteratorType?: string): any {
    this.init()
    return this.getTransientProcessor().stripTransients(
      object,
      this.schemaIterator,
      iteratorType
    )
  }

  stripFunctions(obj) {
    return this.getTransientProcessor().stripFunctions(obj)
  }

  async validate(
    object: any,
    config?: SchemaConfig
  ): Promise<SchemaValidationResult> {
    this.init()
    var meta: SchemaValidationMeta = { errors: {} }
    config = config ? config : {}

    var promises = []
    this.schemaIterator.iterate(
      object,
      (opts) => {
        promises.push(
          (async () => {
            let {
              spec,
              specParent,
              fieldName,
              container,
              path,
              meta: mapperMeta,
            } = opts
            try {
              let value = await this.validateField({
                spec,
                specParent,
                fieldName,
                value: container ? container[fieldName] : undefined,
                path,
                config,
                meta,
                mapperMeta,
              })
              if (container) container[fieldName] = value
            } catch (e) {
              throw new Error(
                'Validate field failed at "' + path + '": ' + e.toString()
              )
            }
          })()
        )
      },
      {
        // If the spec is for related data we do not validate
        // - this data will be stripped before any insertion or updating to persistence
        skipTransients: true,
      }
    )

    await Promise.all(promises)

    meta.isValid = Object.keys(meta.errors).length == 0

    return meta
  }

  async validatePaths(
    paths: SchemaPaths | Array<SchemaPaths>,
    config?: SchemaConfig,
    meta?: SchemaValidationMeta
  ): Promise<SchemaValidationResult> {
    this.init()
    var meta = meta ? meta : { errors: {} }
    var objects = Array.isArray(paths) ? paths : [paths]
    config = config ? config : {}

    var promises = []
    this.schemaIterator.iteratePaths(
      objects,
      (opts) => {
        promises.push(
          (async () => {
            let {
              spec,
              specParent,
              fieldName,
              container,
              path,
              meta: mapperMeta,
            } = opts
            try {
              mapperMeta.root = container
              let value = await this.validateField({
                spec,
                specParent,
                fieldName,
                value: container ? container[fieldName] : undefined,
                path,
                config,
                meta,
                mapperMeta,
              })
              if (container) container[fieldName] = value
            } catch (e) {
              throw new Error(
                'Validate field failed at "' + path + '": ' + e.toString()
              )
            }
          })()
        )
      },
      {
        // If the spec is for related data we do not validate
        // - this data will be stripped before any insertion or updating to persistence
        skipTransients: true,
      }
    )

    await Promise.all(promises)

    meta.isValid = Object.keys(meta.errors).length == 0

    return meta
  }

  async validateQuery(
    query: any,
    config?: SchemaConfig
  ): Promise<SchemaValidationResult> {
    this.init()
    var meta = meta ? meta : { errors: {} }
    config = config ? config : {}
    // This is a query - we are expecting fields which are not defined
    // - We don't want those to trigger an error so disabled strict validation
    config.strict = false

    var promises = []
    this.schemaIterator.mapQueryPaths(
      query,
      (path, queryPathFieldName, queryPathContainer) => {
        var paths = {}
        paths[path] = queryPathContainer[queryPathFieldName]
        this.schemaIterator.iteratePaths(
          paths,
          (opts) => {
            promises.push(
              (async () => {
                let { spec, specParent, fieldName, container, path } = opts
                let value = await this.validateField({
                  spec,
                  specParent,
                  fieldName,
                  value: container ? container[fieldName] : undefined,
                  path,
                  config,
                  meta,
                })
                if (queryPathContainer)
                  queryPathContainer[queryPathFieldName] = value
              })()
            )
          },
          { skipTransients: true }
        )
      },
      { skipTransients: true }
    )

    await Promise.all(promises)

    meta.isValid = Object.keys(meta.errors).length == 0

    return meta
  }

  filterPrivate(object: any, mode?: boolean | string, iteratorType?: string) {
    this.init()
    return this.getFieldPrivateFilter().filterPrivate(
      object,
      this.schemaIterator,
      mode,
      iteratorType
    )
  }

  specToFieldType(spec, value) {
    return this.getFieldTypeCaster().specToFieldType(spec, value)
  }

  async validateField(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    fieldName: string | number
    value: any
    path: string | number
    config?: SchemaConfig
    meta?: SchemaValidationMeta
    mapperMeta?: SchemaIteratorMeta
  }) {
    return this.getFieldValidator().validateField(opts)
  }

  async filterField(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    fieldName: string | number
    value: any
    path: string | number
    config?: SchemaConfig
    meta?: SchemaValidationMeta
    mapperMeta?: SchemaIteratorMeta
  }) {
    return this.getFieldFilter().filterField(opts)
  }

  typeCast(requiredType: any, value, path?, meta?: SchemaValidationMeta) {
    return this.getFieldTypeCaster().typeCast(requiredType, value, path, meta)
  }

  static appendError(meta: SchemaValidationMeta, path, error) {
    var errors = Array.isArray(meta.errors[path]) ? meta.errors[path] : []
    errors.push(error)
    meta.errors[path] = errors
  }

  static isNull(value: any) {
    var result =
      value === null ||
      // The string value NULL or null are treated as a literal null
      (typeof value == 'string' && value.toLowerCase() == 'null')

    return result
  }

  static mergeValidationResults(
    results: Array<SchemaValidationResult>
  ): SchemaValidationResult {
    results = Array.isArray(results) ? results : []
    var finalResult = { errors: {} } as SchemaValidationResult
    results.forEach((result) => {
      if (result.errors) Object.assign(finalResult.errors, result.errors)
    })
    finalResult.isValid = Object.keys(finalResult.errors).length == 0
    return finalResult
  }

  async applyFilters<T extends any>(
    object: T,
    config?: SchemaConfig
  ): Promise<T> {
    this.init()
    var meta: SchemaValidationMeta = { errors: {} }
    config = config ? config : {}

    var promises = []
    this.schemaIterator.iterate(object, (opts) => {
      promises.push(
        (async () => {
          let {
            spec,
            specParent,
            fieldName,
            container,
            path,
            meta: mapperMeta,
          } = opts
          try {
            let value = await this.filterField({
              spec,
              specParent,
              fieldName,
              value: container ? container[fieldName] : undefined,
              path,
              config,
              meta,
              mapperMeta,
            })
            if (container) container[fieldName] = value
          } catch (e) {
            throw new Error(
              'Filter field failed at "' + path + '": ' + e.toString()
            )
          }
        })()
      )
    })

    await Promise.all(promises)

    return object
  }

  async applyEncrypt<T>(object: T): Promise<T> {
    this.init()
    const promises: Promise<void>[] = []
    this.schemaIterator.iterate(object, (opts) => {
      const { spec, fieldName, container } = opts
      if (!spec?.$filter?.encrypt) return
      if (!container || container[fieldName] == null) return
      if (!this.config.encryptionService) {
        throw new Error(
          `Encryption required for field "${String(fieldName)}" but no encryptionService configured in schema`
        )
      }
      const service = this.config.encryptionService
      promises.push(
        (async () => {
          container[fieldName] = await service.encrypt(
            String(container[fieldName])
          )
        })()
      )
    })
    await Promise.all(promises)
    return object
  }

  async applyEncryptPaths<T extends Record<string, any>>(paths: T): Promise<T> {
    this.init()
    const promises: Promise<void>[] = []
    this.schemaIterator.iteratePaths(
      paths,
      (opts) => {
        const { spec, fieldName, container } = opts
        if (!spec?.$filter?.encrypt) return
        if (!container || container[fieldName] == null) return
        if (!this.config.encryptionService) {
          throw new Error(
            `Encryption required for field "${String(fieldName)}" but no encryptionService configured in schema`
          )
        }
        const service = this.config.encryptionService
        promises.push(
          (async () => {
            container[fieldName] = await service.encrypt(
              String(container[fieldName])
            )
          })()
        )
      },
      { skipTransients: true }
    )
    await Promise.all(promises)
    return paths
  }

  async applyDecrypt<T>(object: T): Promise<T> {
    this.init()
    const promises: Promise<void>[] = []
    this.schemaIterator.iterate(object, (opts) => {
      const { spec, fieldName, container } = opts
      if (!spec?.$filter?.encrypt) return
      if (
        !container ||
        container[fieldName] == null ||
        container[fieldName] === ''
      )
        return
      if (!this.config.encryptionService) {
        throw new Error(
          `Encryption required for field "${String(fieldName)}" but no encryptionService configured in schema`
        )
      }
      const service = this.config.encryptionService
      promises.push(
        (async () => {
          container[fieldName] = await service.decrypt(
            String(container[fieldName])
          )
        })()
      )
    })
    await Promise.all(promises)
    return object
  }
}

export default Schema
