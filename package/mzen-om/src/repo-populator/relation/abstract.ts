import { Repo } from 'repo'
import { RelationConfig } from 'repo-populator'
import { ObjectPathAccessor } from 'mzen-schema'
import clone = require('clone')

export abstract class RelationAbstract {
  abstract populate(
    relationRepo: Repo<any>,
    relationConfig: RelationConfig,
    docs
  )

  private formatKey(key) {
    // Relation keys must be cast to a string during lookup
    // Keys such as Date or ObjectID will have been implicitly cast to string when they were set to the
    // - values object before being passed into populateValues(), so they must but referenced as a string
    // - when looking up the related value
    return key && typeof key != 'string' ? String(key) : key
  }

  // Merge key and keys into a normalized keys object
  // This converts legacy key/pkey config into the unified keys format
  // Returns: { sourceField: targetField } mapping
  protected getNormalizedKeys(config: RelationConfig): {
    [key: string]: string
  } {
    const keys = config.keys ? { ...config.keys } : {}

    // Add legacy key property to keys if present
    if (config.key) {
      const pkey = config.pkey || '_id'
      // For belongsTo: key is source field, pkey is target field
      // For has: key is target field, pkey is source field
      const relationType = config.type?.toLowerCase() || ''
      if (relationType.includes('belongsto')) {
        keys[config.key] = pkey
      } else {
        keys[pkey] = config.key
      }
    }

    return keys
  }

  // Create a composite key string from document values
  // For single key: returns "value1"
  // For composite: returns "value1||value2||value3"
  protected createCompositeKey(doc: any, fields: string[]): string {
    return fields
      .map((field) => {
        const value = doc[field]
        return value !== undefined ? String(value) : '__undefined__'
      })
      .join('||')
  }

  // Extract composite key values from documents
  // Returns array of objects with field->value mappings for each unique combination
  protected getCompositeRelationIds(
    config: RelationConfig,
    docs: any
  ): Array<{ [field: string]: any }> {
    const keys = this.getNormalizedKeys(config)
    const sourceFields = Object.keys(keys)

    // Return array of objects with field values for each doc
    const docsArray = Array.isArray(docs) ? docs : [docs]
    const docPath = config.docPath ? `*.${config.docPath}` : '*'
    const embeddedDocs = ObjectPathAccessor.getPath(docPath, docsArray)

    const compositeIds: Array<{ [field: string]: any }> = []
    embeddedDocs.forEach((doc) => {
      if (!doc) return
      const compositeId: { [field: string]: any } = {}
      let hasAllFields = true

      sourceFields.forEach((sourceField) => {
        if (doc[sourceField] !== undefined) {
          const value = doc[sourceField]
          // For belongsToMany, the value might be an array
          // In this case, we'll flatten it later in the query building
          compositeId[sourceField] = value
        } else {
          hasAllFields = false
        }
      })

      if (hasAllFields) {
        compositeIds.push(compositeId)
      }
    })

    return compositeIds
  }

  // Analyze composite IDs to identify constant vs variant fields
  // Returns: { constantFields: {field: value}, variantFields: {field: [values]} }
  protected analyzeCompositeFields(
    compositeIds: Array<{ [field: string]: any }>,
    sourceFields: string[]
  ): {
    constantFields: { [field: string]: any }
    variantFields: { [field: string]: any[] }
  } {
    if (compositeIds.length === 0) {
      return { constantFields: {}, variantFields: {} }
    }

    const constantFields: { [field: string]: any } = {}
    const variantFields: { [field: string]: Set<any> } = {}

    // Check each field to see if it has a constant value across all composite IDs
    sourceFields.forEach((field) => {
      const firstValue = compositeIds[0][field]
      let isConstant = true

      // Skip array values (belongsToMany) - always treat as variant
      if (Array.isArray(firstValue)) {
        isConstant = false
      } else {
        // Check if all composite IDs have the same value for this field
        for (let i = 1; i < compositeIds.length; i++) {
          if (compositeIds[i][field] !== firstValue) {
            isConstant = false
            break
          }
        }
      }

      if (isConstant && !Array.isArray(firstValue)) {
        constantFields[field] = firstValue
      } else {
        // Collect all unique values for this variant field
        const valueSet = new Set<any>()
        compositeIds.forEach((id) => {
          const value = id[field]
          if (Array.isArray(value)) {
            value.forEach((v) => valueSet.add(v))
          } else {
            valueSet.add(value)
          }
        })
        variantFields[field] = valueSet
      }
    })

    // Convert Sets to arrays
    const variantFieldsArray: { [field: string]: any[] } = {}
    Object.keys(variantFields).forEach((field) => {
      variantFieldsArray[field] = Array.from(variantFields[field])
    })

    return { constantFields, variantFields: variantFieldsArray }
  }

  // Build optimized query for composite keys
  // Detects constant fields and uses $in for variant fields to minimize $or clauses
  protected buildOptimizedCompositeQuery(
    compositeIds: Array<{ [field: string]: any }>,
    keys: { [sourceField: string]: string }
  ): any {
    const sourceFields = Object.keys(keys)
    const targetFields = Object.values(keys)

    // Analyze which fields are constant vs variant
    const { constantFields, variantFields } = this.analyzeCompositeFields(
      compositeIds,
      sourceFields
    )

    const query: any = {}

    // Add constant fields as simple equality
    Object.keys(constantFields).forEach((sourceField) => {
      const targetField = keys[sourceField]
      query[targetField] = constantFields[sourceField]
    })

    // If we have exactly one variant field, use $in
    const variantFieldNames = Object.keys(variantFields)
    if (variantFieldNames.length === 1) {
      const sourceField = variantFieldNames[0]
      const targetField = keys[sourceField]
      query[targetField] = { $in: variantFields[sourceField] }
    } else if (variantFieldNames.length > 1) {
      // Multiple variant fields - need $or
      // Group by constant fields to minimize $or clauses
      const groups = new Map<string, Array<{ [field: string]: any }>>()

      compositeIds.forEach((compositeId) => {
        // Create a key from constant field values
        const constantKey = Object.keys(constantFields)
          .map((f) => String(compositeId[f]))
          .join('||')

        if (!groups.has(constantKey)) {
          groups.set(constantKey, [])
        }
        groups.get(constantKey)!.push(compositeId)
      })

      // Build $or with one clause per constant group
      query.$or = Array.from(groups.values()).map((group) => {
        const orCondition: any = {}

        // Add constant fields
        Object.keys(constantFields).forEach((sourceField) => {
          const targetField = keys[sourceField]
          orCondition[targetField] = constantFields[sourceField]
        })

        // For variant fields, check if we can use $in within this group
        variantFieldNames.forEach((sourceField) => {
          const targetField = keys[sourceField]
          const valuesInGroup = new Set<any>()

          group.forEach((id) => {
            const value = id[sourceField]
            if (Array.isArray(value)) {
              value.forEach((v) => valuesInGroup.add(v))
            } else {
              valuesInGroup.add(value)
            }
          })

          const uniqueValues = Array.from(valuesInGroup)
          if (uniqueValues.length === 1) {
            orCondition[targetField] = uniqueValues[0]
          } else {
            orCondition[targetField] = { $in: uniqueValues }
          }
        })

        return orCondition
      })
    }

    return query
  }

  protected getRelationIds(config: RelationConfig, docs): (string | number)[] {
    config = this.normalizeConfig(config)

    // Ensure docs is always an array
    const docsArray = Array.isArray(docs) ? docs : [docs]

    // If we were given a document path, the path is relative to the object not to the array of objects
    // - prefix the document path with '*' so it will pull all elements from the array
    const docPath = config.docPath ? `*.${config.docPath}` : '*'
    const embeddedDocs: any[] = ObjectPathAccessor.getPath(docPath, docsArray)

    return embeddedDocs.reduce((relationIds: (string | number)[], doc) => {
      if (doc && config.sourceKey) {
        const id: string | number | (string | number)[] = doc[config.sourceKey]

        if (Array.isArray(id)) {
          // Only belongsToMany relation supports an array of source keys
          id.forEach((anId: string | number) => {
            // We must store the id as a primitive as they are referenced as by lookup object
            // - complex types can not be used as object field names
            if (!relationIds.includes(anId)) {
              relationIds.push(anId)
            }
          })
        } else {
          // We must store the id as a primitive as they are referenced as by lookup object
          // - complex types can not be used as object field names
          relationIds.push(id)
        }
      }
      return [...new Set(relationIds)]
    }, [])
  }

  protected populateValues(
    config: RelationConfig,
    docs,
    values,
    relationRepo: Repo<any>
  ) {
    config = this.normalizeConfig(config)

    // We may be passed an array of docs or a single doc
    // - we want to deal with both situations uniformly
    // - if we are passed a single object we make it an array
    const normalizedDocs = Array.isArray(docs) ? docs : [docs]

    // If we were given a document path, the path is relative to the object not to the array of objects
    // - prefix the document path with '*' so it will pull all elements from the array
    const docPath = config.docPath ? '*.' + config.docPath : '*'
    const embeddedDocs = ObjectPathAccessor.getPath(docPath, normalizedDocs)

    const keys = this.getNormalizedKeys(config)
    const sourceFields = Object.keys(keys)

    embeddedDocs.forEach((doc) => {
      if (doc !== Object(doc)) return

      // Check if this is belongsToMany (array of source keys)
      // For belongsToMany with single key, the source field value is an array
      if (sourceFields.length === 1) {
        const sourceKey = doc[sourceFields[0]]
        if (Array.isArray(sourceKey)) {
          // This is belongsToMany - use the old path
          this.populateBelongsToMany(
            doc,
            sourceKey,
            config,
            values,
            relationRepo
          )
          return
        }
      }

      // Create composite key from source fields
      const compositeKey = this.createCompositeKey(doc, sourceFields)

      // Use composite key to lookup related values
      this.populateSingleRelation(
        doc,
        compositeKey,
        config,
        values,
        relationRepo
      )
    })

    return normalizedDocs
  }

  private populateBelongsToMany(
    doc: any,
    sourceKeys: any[],
    config: RelationConfig,
    values: Record<string, any>,
    relationRepo: Repo<any>
  ) {
    if (config.alias === undefined) return
    const relatedDocs = sourceKeys
      .map(this.formatKey)
      .filter((key) => key in values)
      .map((key) => values[key])

    doc[config.alias] = relationRepo?.schema?.applyTransients
      ? relationRepo?.schema?.applyTransients(relatedDocs)
      : relatedDocs
  }

  private populateSingleRelation(
    doc: Record<string, any>,
    sourceKey: any,
    config: RelationConfig,
    values: Record<string, any>,
    relationRepo: Repo<any>
  ) {
    if (config.alias === undefined) return
    const formattedKey = this.formatKey(sourceKey)
    // Check if this is a *One or *Many relation (single doc vs array)
    const relationType = config.type?.toLowerCase() || ''
    const isSingleRelation = relationType.includes('one')
    const isArrayRelation = relationType.includes('many')
    const isCountRelation = relationType.includes('count')

    let relatedDocs = values[formattedKey]

    // For hasOne/hasMany, values are already grouped in arrays
    // For hasOne, extract first element
    if (relationType.includes('has') && isSingleRelation && relatedDocs) {
      relatedDocs = relatedDocs[0]
    }

    // For count relations, default to 0 if undefined (counts are numbers, not arrays)
    if (relatedDocs == undefined && isCountRelation) {
      relatedDocs = 0
    }
    // For array relations (hasMany, belongsToMany), default to empty array if undefined
    else if (relatedDocs == undefined && isArrayRelation) {
      relatedDocs = []
    }

    // For count relations, the value is a primitive number, not a document
    // Do not apply transients as that would try to instantiate the number as a document object
    if (isCountRelation) {
      doc[config.alias] = relatedDocs
    } else {
      doc[config.alias] = relationRepo?.schema?.applyTransients
        ? relationRepo?.schema?.applyTransients(relatedDocs)
        : relatedDocs
    }
  }

  protected normalizeConfig(relationConfig: RelationConfig) {
    let config: RelationConfig = clone(relationConfig)
    // pkey is the primary key name to use when looking up relations
    // - the primary key is the key of the source document on has* type relations
    // - the primary key is the key of the related document on blongsTo* type relations
    config.pkey = config.pkey ? config.pkey : '_id'
    // Key is the field where the relation id is stored in the related document
    // - for all except belongsTo type relations where the key is on the source document
    config.key = config.key ? config.key : ''
    // keys is the composite key mapping for multi-column joins
    config.keys = config.keys ? config.keys : undefined

    // relation type name
    config.type = config.type ? config.type : ''

    // NOTE: sourceKey is still set for backward compatibility with getRelationIds()
    // but is no longer used in the unified composite key implementation
    config.sourceKey =
      config.type.toLowerCase().indexOf('belongsto') != -1
        ? config.key
        : config.pkey

    // Ensure sourceKey is always defined
    if (config.sourceKey === undefined) {
      config.sourceKey = '_id' // Default to '_id' if sourceKey is still undefined
    }

    // alias is the field name used to store the compiled relations
    config.alias = config.alias ? config.alias : ''
    // docPath is path to the object(s) where the relation should be populated
    config.docPath = config.docPath ? config.docPath : undefined
    // docPathRelated is the path to the related objects
    config.docPathRelated = config.docPathRelated
      ? config.docPathRelated
      : undefined

    // query is query object used to further filter related objects
    config.query = config.query ? config.query : {}
    // doc of fields to include or exclude (not both), {'field':1} or  {'field':0}
    config.fields = config.fields ? config.fields : undefined

    config.populate = config.populate !== false

    return config
  }
}

export default RelationAbstract
