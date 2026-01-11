import SchemaUtility from './utilities/utility'
import SchemaTypes from './types'
import TypeCaster from './utilities/type-caster'
import Schema from './schema'
import SchemaConfig from './config'
import SchemaSpec from './spec'

export interface SchemaIteratorCallback {
  (opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    fieldName: string | number
    container: object
    path: string
    meta: SchemaIteratorMeta
  }): void
}

export interface SchemaIteratorMappingConfig {
  skipTransients?: boolean
}

export interface SchemaIteratorMeta {
  root?: object
  specParent?: SchemaSpec
  errors?: object
}

export class SchemaIterator {
  private specNormalised: SchemaSpec
  private schemas: { [key: string]: Schema } = {}

  constructor(
    private spec: SchemaSpec,
    config: SchemaConfig = {}
  ) {
    this.addSchemas(config.schemas || {})
  }

  init() {
    if (!this.specNormalised) {
      this.specNormalised = this.normalizeSpec(this.spec)
    }
  }

  getSpec(): SchemaSpec {
    this.init()
    return this.specNormalised
  }

  getSpecPath(path: string): SchemaSpec {
    return SchemaUtility.getSpec(path, this.getSpec())
  }

  addSchema(schema: Schema) {
    if (schema.getName) {
      this.schemas[schema.getName()] = schema
    } else {
      throw new Error('Invalid schema')
    }
  }

  addSchemas(schemas: { [key: string]: Schema } | Array<Schema>) {
    const schemasArray = Array.isArray(schemas)
      ? schemas
      : Object.values(schemas)
    schemasArray.forEach((schema) => {
      if (schema instanceof Schema) this.addSchema(schema)
    })
  }

  normalizeSpec(spec: SchemaSpec): SchemaSpec {
    if (Array.isArray(spec)) {
      return spec.map((value) => this.normalizeSpec(value))
    }

    if (spec && typeof spec === 'object') {
      if (spec.$schema) {
        const name = spec.$schema
        if (!this.schemas[name]) {
          throw new Error(`Missing schema reference ${name}`)
        }
        const result = { ...this.schemas[name].getSpec(), ...spec }
        delete result.$schema
        return result
      }

      return Object.fromEntries(
        Object.entries(spec).map(([key, value]) => {
          if (
            (!SchemaUtility.isOperator(key) ||
              key === '$spec' ||
              key === '$or') &&
            (Array.isArray(value) || typeof value === 'object')
          ) {
            return [key, this.normalizeSpec(value)]
          }
          return [key, value]
        })
      )
    }

    return spec
  }

  iterate(
    data: Array<object> | any,
    callback: SchemaIteratorCallback,
    config?: SchemaIteratorMappingConfig
  ) {
    this.init()
    const meta: SchemaIteratorMeta = { errors: {}, root: data }
    const spec = Array.isArray(data)
      ? { $type: Array, $spec: this.specNormalised }
      : this.specNormalised

    if (SchemaIterator.specIsTransient(spec) && config?.skipTransients) return

    return this.mapField({
      spec,
      specParent: null,
      fieldName: 'root',
      container: { root: data },
      path: '',
      callback,
      config,
      meta,
    })
  }

  iteratePaths(
    paths: any,
    callback: SchemaIteratorCallback,
    config?: SchemaIteratorMappingConfig,
    meta?: SchemaIteratorMeta
  ) {
    this.init()
    const metaObj = meta
      ? meta
      : ({ path: '', errors: {} } as SchemaIteratorMeta)
    const objects = Array.isArray(paths) ? paths : [paths]

    objects.forEach((container) => {
      for (const fieldName in container) {
        const spec = SchemaUtility.getSpec(fieldName, this.specNormalised)
        this.mapField({
          spec,
          specParent: null,
          fieldName,
          container,
          path: fieldName,
          callback,
          config,
          meta: metaObj,
        })
      }
    })

    return paths
  }

  mapQueryPaths(
    query: any,
    callback: Function,
    _config?: SchemaIteratorMappingConfig
  ) {
    const mapRecursiveQuery = (query: any) => {
      if (Array.isArray(query)) {
        query.forEach(mapRecursiveQuery)
        return
      }

      if (typeof query !== 'object' || query === null) {
        return
      }

      Object.entries(query).forEach(([fieldName, value]) => {
        if (SchemaUtility.isOperator(fieldName)) {
          if (SchemaUtility.canValidateQueryOperator(fieldName)) {
            if (Array.isArray(value) && ['$or', '$and'].includes(fieldName)) {
              value.forEach(mapRecursiveQuery)
            } else {
              mapRecursiveQuery(value)
            }
          }
        } else {
          const isObject = typeof value === 'object' && value !== null
          const hasOperators =
            isObject && Object.keys(value).some(SchemaUtility.isOperator)

          if (hasOperators) {
            Object.entries(value).forEach(([childFieldName, childValue]) => {
              if (
                SchemaUtility.isOperator(childFieldName) &&
                SchemaUtility.canValidateQueryOperator(childFieldName)
              ) {
                if (Array.isArray(childValue)) {
                  childValue.forEach((_, index) =>
                    callback(fieldName, index, childValue)
                  )
                } else {
                  callback(fieldName, childFieldName, value)
                }
              }
            })
          } else {
            if (Array.isArray(value)) {
              value.forEach((_, index) => callback(fieldName, index, value))
            } else {
              callback(fieldName, fieldName, query)
            }
          }
        }
      })
    }

    mapRecursiveQuery(query)
  }

  specInheritFrom(parent: SchemaSpec, child: SchemaSpec) {
    if (
      parent &&
      TypeCaster.getType(parent) == Object &&
      child &&
      TypeCaster.getType(child) == Object
    ) {
      if (child.$strict === undefined) child.$strict = parent.$strict
    }
    return child
  }

  mapRecursive(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    object: any
    path: string
    callback: SchemaIteratorCallback
    config?: SchemaIteratorMappingConfig
    meta?: SchemaIteratorMeta
  }) {
    const { spec, specParent, object, path, callback, config, meta } = opts

    this.init()
    const currentPath = this.initPath(path)

    if (SchemaIterator.specIsTransient(spec) && config && config.skipTransients)
      return

    const matchAllSpec = (spec && spec['*']) || undefined

    let finalSpec = this.specInheritFrom(
      specParent,
      (!matchAllSpec && { ...spec }) || spec
    )

    // When matchAllSpec is defined, create a clean finalSpec without '*'
    if (matchAllSpec !== undefined && finalSpec === spec) {
      // Create a copy of spec without the '*' property
      const { '*': _, ...specWithoutMatchAll } = spec as any
      finalSpec = specWithoutMatchAll
    }

    for (const fieldName in object) {
      if (matchAllSpec !== undefined) {
        finalSpec[fieldName] = matchAllSpec
      } else if (
        finalSpec === undefined ||
        finalSpec[fieldName] === undefined
      ) {
        finalSpec[fieldName] = undefined
      }
    }

    for (const fieldName in finalSpec) {
      if (SchemaUtility.isOperator(fieldName)) continue
      // Skip '*' as it's a match-all pattern, not an actual field name
      if (fieldName === '*') continue
      const fieldPath = currentPath
        ? currentPath + '.' + fieldName
        : '' + fieldName
      this.mapField({
        spec: finalSpec[fieldName],
        specParent: finalSpec,
        fieldName,
        container: object,
        path: fieldPath,
        callback,
        config,
        meta,
      })
    }
  }

  mapArrayElements(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    array: Array<any>
    path: string
    callback: SchemaIteratorCallback
    config?: SchemaIteratorMappingConfig
    meta?: SchemaIteratorMeta
  }) {
    const { spec, specParent, array, path, callback, config, meta } = opts

    this.init()
    const currentPath = this.initPath(path)

    if (SchemaIterator.specIsTransient(spec) && config && config.skipTransients)
      return

    array.forEach((_element, fieldName) => {
      this.mapField({
        spec,
        specParent,
        fieldName,
        container: array,
        path: currentPath ? currentPath + '.' + fieldName : '' + fieldName,
        callback,
        config,
        meta,
      })
    })
  }

  mapField(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    fieldName: string | number
    container: any
    path: string
    callback: SchemaIteratorCallback
    config: SchemaIteratorMappingConfig
    meta: SchemaIteratorMeta
  }) {
    let {
      spec,
      specParent,
      fieldName,
      container,
      path,
      callback,
      config,
      meta,
    } = opts

    this.init()
    const currentPath = this.initPath(path)

    if (SchemaIterator.specIsTransient(spec) && config && config.skipTransients)
      return

    let fieldType: string | number | Object = undefined
    let nullable = false
    if (spec) {
      fieldType = spec.constructor == String ? spec : TypeCaster.getType(spec)
      nullable = !!spec.$nullable
    }
    if (fieldType == Object && spec.$type !== undefined) fieldType = spec.$type
    if (fieldType && fieldType.constructor == String) {
      fieldType = SchemaTypes[fieldType]
    }

    let defaultValue = undefined
    if (fieldType == Object) {
      defaultValue = nullable ? null : {}
    } else if (fieldType == Array) {
      defaultValue = []
    }
    if (
      container &&
      container[fieldName] === undefined &&
      defaultValue !== undefined
    ) {
      container[fieldName] = defaultValue
    }

    callback({
      spec,
      specParent,
      fieldName,
      container,
      path: currentPath,
      meta,
    })

    const isNullNullable =
      defaultValue === null && container && container[fieldName] === null

    // Check if spec has match-all '*' with $or - don't descend, let validation handle it
    const hasMatchAllWithOr = spec && spec['*'] && spec['*'].$or

    switch (fieldType) {
      case Object:
        if (!isNullNullable && !spec.$or && !hasMatchAllWithOr) {
          // Don't descend into objects when $or is present - validation will handle it
          if (spec.$spec !== undefined) spec = spec.$spec
          this.mapRecursive({
            spec,
            specParent,
            object: container ? container[fieldName] : undefined,
            path: currentPath,
            callback,
            config,
            meta,
          })
        }
        break
      case Array:
        if (!spec.$or && !hasMatchAllWithOr) {
          // Don't descend into arrays when $or is present - validation will handle it
          let arraySpec = undefined
          if (Array.isArray(spec) && spec[0]) {
            arraySpec = spec[0]
          } else if (TypeCaster.getType(spec) == Object && spec.$spec) {
            arraySpec = spec.$spec
          }
          if (container && arraySpec && container[fieldName]) {
            this.mapArrayElements({
              spec: arraySpec,
              specParent,
              array: container[fieldName],
              path: currentPath,
              callback,
              config,
              meta,
            })
          }
        }
        break
    }

    return container ? container[fieldName] : undefined
  }

  initPath(path) {
    return path !== undefined && path.length ? path : ''
  }

  static specIsTransient(spec: SchemaSpec): boolean {
    return !!(spec && (spec.$relation != null || spec.$pathRef != null))
  }
}

export default SchemaIterator
