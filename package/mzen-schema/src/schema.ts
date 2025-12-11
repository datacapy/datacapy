import SchemaUtility from './utility'
import { SchemaIterator, SchemaIteratorMeta } from './iterator'
import Collection from './collection'
import Validator from './validator'
import Filter from './filter'
import SchemaTypes from './types'
import TypeCaster from './type-caster'
import ObjectPathAccessor from './object-path-accessor'
import SchemaConfig from './config'
import SchemaSpec from './spec'
import SchemaInquisitor from './inquisitor'
import { genUniqueId } from 'mzen-id'

export interface SchemaValidationMeta {
  errors?: any
  isValid?: boolean
}

export interface SchemaValidationResult {
  errors?: { [path: string]: string[] }
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
    return object && this.constructors
      ? this.schemaIterator.iterate(object, (opts) => {
          let { spec, fieldName, container, path, meta: mapperMeta } = opts
          if (!container) return

          let pathRef = spec ? spec.$pathRef : null
          if (pathRef) {
            container[fieldName] = ObjectPathAccessor.getPath(
              pathRef,
              mapperMeta.root
            )
          } else {
            const fieldType = this.specToFieldType(spec, container[fieldName])
            if (container[fieldName] != undefined) {
              // We only attempt to type cast if the type was specified, the value is not null and not undefined
              // - a type cast failure would result in an error which we do not want in the case of undefined or null
              // - these indicate no-value, and so there is nothing to cast
              if (fieldType && fieldType != SchemaTypes.Mixed) {
                container[fieldName] = this.typeCast(
                  fieldType,
                  container[fieldName],
                  path
                )
              }
            }
          }

          let construct
          if (container[fieldName] && Array.isArray(container[fieldName])) {
            construct =
              spec?.$constructCollection ||
              spec?.$spec?.$constructCollection ||
              spec?.$construct ||
              Collection
          } else {
            construct = spec?.$construct || spec?.$spec?.$construct
          }
          // Skip constructor if value is null and field is nullable
          const isNullable = spec?.$nullable || spec?.$spec?.$nullable
          const isNull = container[fieldName] === null
          if (construct && !(isNull && isNullable)) {
            let constructorFunction = null
            if (typeof construct === 'string' && this.constructors[construct]) {
              constructorFunction = this.constructors[construct]
            } else if (typeof construct === 'function') {
              constructorFunction = construct
            } else {
              // constructor not found
              throw new Error(
                `Constructor "${construct}" not found for path "${path}" in schema ${this.name}`
              )
            }
            if (constructorFunction) {
              if (
                Array.isPrototypeOf(constructorFunction) &&
                (!container[fieldName] || Array.isArray(container[fieldName]))
              ) {
                if ('fromArray' in constructorFunction.prototype) {
                  container[fieldName] = new constructorFunction().fromArray(
                    container[fieldName]
                  )
                } else {
                  container[fieldName] = container[fieldName]
                    ? new constructorFunction(...container[fieldName])
                    : Object.create(constructorFunction.prototype)
                }
              } else {
                container[fieldName] = Reflect.construct(constructorFunction, [
                  container[fieldName],
                ])
              }
            }
          }
        })
      : object
  }

  stripTransients(object: any, iteratorType?: string): any {
    this.init()
    var iteratorType =
      iteratorType == 'iteratePaths' ? 'iteratePaths' : 'iterate'
    var deleteRefs = []
    var result = object
      ? this.schemaIterator[iteratorType](object, (opts) => {
          var { spec, fieldName, container } = opts
          if (spec && container) {
            if (spec.$pathRef !== undefined || spec.$relation) {
              deleteRefs.push({ container, fieldName })
            }
          }
        })
      : object
    deleteRefs.forEach((ref) => {
      if (ref.container && ref.container[ref.fieldName])
        delete ref.container[ref.fieldName]
    })
    return result
  }

  stripFunctions(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    if (Array.isArray(obj)) {
      return obj
        .filter((item) => typeof item !== 'function')
        .map((item) => this.stripFunctions(item))
    }
    const result = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key]
        if (typeof value !== 'function') {
          result[key] = this.stripFunctions(value)
        }
      }
    }

    return result
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
        // - this data will be stripped before any insertion or updating to persistance
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
        // - this data will be stripped before any insertion or updating to persistance
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
    // - We dont want those to trigger an error so disabled strict validation
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
    mode = mode ? mode : true
    var deleteRefs = []
    var valueReplaceRefs = []
    var iteratorType =
      iteratorType == 'iteratePaths' ? 'iteratePaths' : 'iterate'
    var result = object
      ? this.schemaIterator[iteratorType](object, (opts) => {
          let { spec, fieldName, container } = opts
          const filters = spec && spec.$filter ? spec.$filter : {}
          if (filters.private === true || filters.private == mode) {
            // We cant simply delete here because if we delete a parent of a structure we are already
            // - iterating we will get errors. Instead make a list of references to delete.
            // Once we have all the references we can safely delete them.
            if (container) deleteRefs.push({ container, fieldName })
          }
          if (filters.privateValue === true || filters.privateValue == mode) {
            // The privateValue replaces any non null values as true and otherwise false
            // - this allows the removal of the private value while still indicating if a value exists or not
            if (container) valueReplaceRefs.push({ container, fieldName })
          }
        })
      : object

    valueReplaceRefs.forEach((ref) => {
      if (ref.container && ref.container[ref.fieldName]) {
        ref.container[ref.fieldName] =
          ref.container[ref.fieldName] == undefined
            ? ref.container[ref.fieldName]
            : true
      }
    })
    deleteRefs.forEach((ref) => {
      if (ref.container && ref.container[ref.fieldName])
        delete ref.container[ref.fieldName]
    })
    return result
  }

  specToFieldType(spec, value) {
    var fieldType: string | number | Object = undefined
    // If the field type is a string value then it should contain the string name of the required type (converted to a constructor later).
    // - Otherwise we need to find the constructor, if the value is not already a constructor ([] or {})
    if (spec) {
      // Handle $or operator - try to determine type from value
      if (spec.$or && Array.isArray(spec.$or)) {
        // Try each spec in order and see which one's type matches the value best
        for (const orSpec of spec.$or) {
          const orFieldType = this.specToFieldType(orSpec, value)
          if (orFieldType) {
            const valueType = TypeCaster.getType(value)
            const orTypeName = TypeCaster.getTypeName(orFieldType)
            const valueTypeName = TypeCaster.getTypeName(value)

            // If the types match or can be cast, use this spec's type
            if (
              orTypeName === valueTypeName ||
              orFieldType === valueType ||
              (orFieldType === Object && valueType === Object) ||
              (orFieldType === Array && Array.isArray(value))
            ) {
              return orFieldType
            }
          }
        }
        // If no perfect match, return the first spec's type (priority order)
        if (spec.$or.length > 0) {
          return this.specToFieldType(spec.$or[0], value)
        }
        return undefined
      }

      if (spec.constructor == String) {
        fieldType = spec
      } else {
        fieldType = TypeCaster.getType(spec)
        if (fieldType === Object) {
          if (spec.$type !== undefined) {
            // The type specified in a spec object may be a constructor or a string also so this is recursive
            fieldType = this.specToFieldType(spec.$type, value)
          }
        }
      }
    }

    if (fieldType && fieldType.constructor == String) {
      // The fieldType was specified with a String value (not a string constructor)
      // Attempt to convert the field type to a constructor
      fieldType = SchemaTypes[fieldType]
    }

    return fieldType
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
    var { spec, specParent, fieldName, value, path, config, meta, mapperMeta } =
      opts

    path = path ? path : fieldName
    config = config ? config : {}
    meta = meta ? meta : { errors: [] }
    mapperMeta = mapperMeta ? mapperMeta : {}

    // Handle $or operator - try each spec in priority order
    if (spec && spec.$or && Array.isArray(spec.$or)) {
      const orSpecs = spec.$or
      const orErrors: Array<{ [path: string]: string[] }> = []
      let matchedSpec: SchemaSpec | null = null
      let matchedValue: any = value
      let bestMatch: {
        spec: SchemaSpec
        value: any
        typeCasted: boolean
      } | null = null

      const valueTypeName = value == null ? null : TypeCaster.getTypeName(value)

      for (const orSpec of orSpecs) {
        // Create a temporary meta object for this spec attempt
        const tempMeta: SchemaValidationMeta = { errors: {} }

        try {
          // Try to validate with this spec
          const testValue = await this.validateField({
            spec: orSpec,
            specParent,
            fieldName: 'tempField',
            value,
            path,
            config,
            meta: tempMeta,
            mapperMeta,
          })

          // If no errors, this spec is a candidate
          if (Object.keys(tempMeta.errors).length === 0) {
            // Check if type casting was needed
            const resultTypeName =
              testValue == null ? null : TypeCaster.getTypeName(testValue)

            const typeCasted = valueTypeName !== resultTypeName

            // Prefer exact type matches (no type casting) over type-casted matches
            if (!bestMatch || (!typeCasted && bestMatch.typeCasted)) {
              bestMatch = { spec: orSpec, value: testValue, typeCasted }

              // If we found an exact match (no type casting), use it immediately
              if (!typeCasted) {
                matchedSpec = orSpec
                matchedValue = testValue
                break
              }
            } else if (!bestMatch.typeCasted && !typeCasted) {
              // Both are exact matches, use the first one (priority order)
              matchedSpec = orSpec
              matchedValue = testValue
              break
            }
          } else {
            // Store errors for potential reporting
            orErrors.push(tempMeta.errors)
          }
        } catch (e) {
          // If validation threw an error, store it and continue
          orErrors.push({ [path as string]: [e.toString()] })
        }
      }

      // Use best match if we found one
      if (bestMatch && !matchedSpec) {
        matchedSpec = bestMatch.spec
        matchedValue = bestMatch.value
      }

      // If we found a matching spec, return the validated value
      if (matchedSpec) {
        return matchedValue
      }

      // If no specs matched, append all errors to meta
      if (orErrors.length > 0) {
        orErrors.forEach((errorSet, index) => {
          for (const errorPath in errorSet) {
            errorSet[errorPath].forEach((error) => {
              Schema.appendError(meta, path, `  [Option ${index + 1}] ${error}`)
            })
          }
        })
      }

      return value
    }

    const validators = spec && spec.$validate ? spec.$validate : {}
    const label = spec && spec.$label ? spec.$label : fieldName
    const strict =
      spec && spec.$strict !== undefined
        ? spec.$strict
        : specParent && specParent.$strict !== undefined
          ? specParent.$strict
          : undefined

    if (!SchemaUtility.isValidFieldName(fieldName)) {
      Schema.appendError(meta, path, 'Invalid field name')
    }

    const fieldType = this.specToFieldType(spec, value)

    // Apply filters
    value = await this.filterField(opts)

    // Handle match-all '*' spec for objects
    // When an object spec has a '*' property, we need to validate all properties of the object
    const matchAllSpec =
      (spec && spec.$spec && spec.$spec['*']) || (spec && spec['*'])

    if (
      fieldType === Object &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      matchAllSpec
    ) {
      // Iterate through each property and validate using the match-all spec
      for (const propName in value) {
        if (typeof value[propName] === 'function') continue

        const propValue = await this.validateField({
          spec: matchAllSpec,
          specParent: spec,
          fieldName: propName,
          value: value[propName],
          path: path ? `${path}.${propName}` : propName,
          config,
          meta,
          mapperMeta,
        })
        value[propName] = propValue
      }
    }

    if (fieldType == Object && strict) {
      // In strict mode we must ensure there are no fields which are not defined by the spec
      for (let fieldName in value) {
        if (typeof value[fieldName] == 'function') continue
        // Allow fields if match-all '*' spec is defined, or if field is explicitly defined
        const hasMatchAll =
          spec.$spec?.['*'] !== undefined || spec['*'] !== undefined
        // Check both spec[fieldName] and spec.$spec[fieldName] for field definitions
        const fieldDefined =
          spec[fieldName] !== undefined ||
          (spec.$spec && spec.$spec[fieldName] !== undefined)
        if (!fieldDefined && !hasMatchAll) {
          Schema.appendError(meta, fieldName, 'Field not specified')
        }
      }
    }

    // notNull can be defaulted via global option
    validators.notNull =
      validators.notNull !== undefined
        ? validators.notNull
        : this.config.defaultNotNull

    if (
      ![SchemaTypes.Array, SchemaTypes.Object].includes(fieldType) &&
      ((value === null && !validators.notNull) ||
        (value === undefined && !validators.required))
    ) {
      return value
    }

    var validateResults = await Validator.validate(value, validators, {
      label,
      root: mapperMeta.root,
    })
    if (Array.isArray(validateResults)) {
      validateResults.forEach((result) => {
        Schema.appendError(meta, path, result)
      })
    }

    return value
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
    var { spec, specParent, fieldName, value, path, config, meta, mapperMeta } =
      opts

    path = path ? path : fieldName
    config = config ? config : {}
    meta = meta ? meta : { errors: [] }
    mapperMeta = mapperMeta ? mapperMeta : {}

    // Handle $or operator - try each spec's filters in priority order
    if (spec && spec.$or && Array.isArray(spec.$or)) {
      const orSpecs = spec.$or

      for (const orSpec of orSpecs) {
        // Create a temporary meta object for this spec attempt
        const tempMeta: SchemaValidationMeta = { errors: {} }

        try {
          // Try to filter with this spec
          const testValue = await this.filterField({
            spec: orSpec,
            specParent,
            fieldName: 'testField',
            value,
            path,
            config,
            meta: tempMeta,
            mapperMeta,
          })

          // If no errors occurred during filtering/type-casting, use this spec
          if (Object.keys(tempMeta.errors).length === 0) {
            return testValue
          }
        } catch (e) {
          // If filtering threw an error, continue to next spec
          continue
        }
      }

      // If no specs worked for filtering, return the original value
      // The validation phase will handle the errors
      return value
    }

    const nullable = spec && spec.$nullable ? spec.$nullable : false
    const filters = spec && spec.$filter ? spec.$filter : {}

    const fieldType = this.specToFieldType(spec, value)

    // Configure default value filter if not already set
    let defaultValue = filters.defaultValue
    if (fieldType == Object) {
      // The $nullable flag indicates that an object can have a null value
      // All other non array values can be null regardless
      // - unless specifically configured as notNull via $validate config
      defaultValue = nullable ? null : {}
    } else if (fieldType == Array) {
      defaultValue = []
    } else if (fieldName == '_id') {
      if (fieldType == SchemaTypes.ObjectID) {
        defaultValue = function () {
          return new SchemaTypes.ObjectID()
        }
      } else if (fieldType == SchemaTypes.String) {
        defaultValue = genUniqueId
      }
    }

    // Default value must be applied before type-casting
    // - because the default value may need to be type-cast
    // - for example converting default value 'now' to type Date
    if (defaultValue !== undefined) {
      value = await Filter.filter(value, { defaultValue })
    }

    if (value != undefined) {
      // We only attempt to type cast if the type was specified, the value is not null and not undefined
      // - a type cast failure would result in an error which we do not want in the case of undefined or null
      // - these indicate no-value, and so there is nothing to cast
      if (fieldType && fieldType != SchemaTypes.Mixed)
        value = this.typeCast(fieldType, value, path, meta)
    }

    // Handle match-all '*' spec for objects
    // When an object spec has a '*' property, we need to apply that spec to all properties of the object
    const matchAllFilterSpec =
      (spec && spec.$spec && spec.$spec['*']) || (spec && spec['*'])

    if (
      fieldType === Object &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      matchAllFilterSpec
    ) {
      // Iterate through each property and apply the match-all spec
      for (const propName in value) {
        if (typeof value[propName] === 'function') continue

        const propValue = await this.filterField({
          spec: matchAllFilterSpec,
          specParent: spec,
          fieldName: propName,
          value: value[propName],
          path: path ? `${path}.${propName}` : propName,
          config,
          meta,
          mapperMeta,
        })
        value[propName] = propValue
      }
    }

    // Apply filters
    value = await Filter.filter(value, filters)

    return value
  }

  typeCast(requiredType: any, value, path?, meta?: SchemaValidationMeta) {
    var meta = meta ? meta : { errors: {} }
    // If the spec specifies the value should be an object and the value is already an object, we do not need to typecast
    // When we specify a type as Object we only care that it is an Object we dont care about its
    // specific constuctor type, we dont care if it is MyObject or YourObject
    var skip =
      (requiredType === Object &&
        Array.isArray(value) == false &&
        Object(value) === value) ||
      (requiredType === Array && Array.isArray(value))
    var result = value

    if (!skip) {
      var result = value
      var requiredTypeName = TypeCaster.getTypeName(requiredType)
      var valueTypeName = TypeCaster.getTypeName(value)

      // We compare type names rather than constructors
      // - because sometimes we need to treat two different implementations as the same type
      // - An example of this is the ObjectID type. MongoDB has its own implementation which should
      // - be considered the same type as ObjectID implementation used by Schema (bson-objectid)
      if (requiredTypeName != valueTypeName) {
        result = TypeCaster.cast(requiredType, value)

        let resultTypeName = TypeCaster.getTypeName(result)
        if (
          // We failed to convert to the specified type
          resultTypeName != requiredTypeName ||
          // We converted to type 'number' but the result was NaN so it is invalid
          (valueTypeName != 'Number' &&
            resultTypeName == 'Number' &&
            isNaN(result))
        ) {
          let origValue =
            ['String', 'Number', 'Boolean'].indexOf(valueTypeName) != -1
              ? "'" + value + "'"
              : ''
          Schema.appendError(
            meta,
            path,
            origValue +
              ' of type ' +
              valueTypeName +
              ' cannot be cast to type ' +
              requiredTypeName
          )
        }
      }
    }

    return result
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
}

export default Schema
