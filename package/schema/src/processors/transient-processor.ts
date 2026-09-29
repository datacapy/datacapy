import { SchemaIterator } from '../iterator'
import Collection from '../utilities/collection'
import SchemaTypes from '../types'
import ObjectPathAccessor from '../utilities/object-path-accessor'
import SchemaFieldTypeCaster from './field-type-caster'

/**
 * Interface for SchemaTransientProcessor
 * Handles transient data processing (apply and strip operations)
 */
export interface SchemaTransientProcessorInterface {
  /**
   * Apply transients to an object (constructors, type casting, path references)
   * @param object - The object to process
   * @param iterator - The schema iterator
   * @param constructors - Constructor registry
   * @param schemas - Schema registry
   * @returns The processed object
   */
  applyTransients(
    object: any,
    iterator: SchemaIterator,
    constructors: { [key: string]: any },
    schemas: { [key: string]: any },
    schemaName: string
  ): any

  /**
   * Strip transients from an object (relations, path references)
   * @param object - The object to process
   * @param iterator - The schema iterator
   * @param iteratorType - Type of iteration (iterate or iteratePaths)
   * @returns The processed object
   */
  stripTransients(
    object: any,
    iterator: SchemaIterator,
    iteratorType?: string
  ): any

  /**
   * Strip functions from an object recursively
   * @param obj - The object to process
   * @returns The object without functions
   */
  stripFunctions(obj: any): any
}

/**
 * SchemaTransientProcessor
 *
 * Handles bidirectional processing of transient data:
 * - Apply transients: Add constructors, type casting, path references
 * - Strip transients: Remove relations and path references
 * - Strip functions: Remove function properties
 *
 * Transient data includes:
 * - Relations ($relation): External references to other schemas
 * - Path references ($pathRef): References to other fields in the object
 * - Constructors ($construct, $constructCollection): Object instantiation
 *
 * This class coordinates with:
 * - SchemaFieldTypeCaster: For type casting during constructor application
 * - ObjectPathAccessor: For resolving path references
 * - Collection: For array construction
 */
export class SchemaTransientProcessor implements SchemaTransientProcessorInterface {
  private fieldTypeCaster: SchemaFieldTypeCaster

  constructor(fieldTypeCaster: SchemaFieldTypeCaster) {
    this.fieldTypeCaster = fieldTypeCaster
  }

  /**
   * Apply transients to an object
   *
   * Handles:
   * - Path references ($pathRef): Copies values from other paths
   * - Type casting: Casts values to specified types
   * - Constructor application ($construct, $constructCollection)
   * - Nullable handling: Skips constructors for null values when nullable
   *
   * @param object - The object to process
   * @param iterator - The schema iterator
   * @param constructors - Constructor registry
   * @param schemas - Schema registry (unused but kept for compatibility)
   * @param schemaName - Schema name (unused but kept for compatibility)
   * @returns The processed object
   */
  applyTransients(
    object: any,
    iterator: SchemaIterator,
    constructors: { [key: string]: any },
    _schemas: { [key: string]: any },
    schemaName: string
  ): any {
    return object && constructors
      ? iterator.iterate(object, (opts) => {
          let { spec, fieldName, container, path, meta: mapperMeta } = opts
          if (!container) return

          let pathRef = spec ? spec.$pathRef : null
          if (pathRef) {
            container[fieldName] = ObjectPathAccessor.getPath(
              pathRef,
              mapperMeta.root
            )
          } else {
            // Skip type casting if $noCast is true (inherited from parent specs)
            const noCast = spec?.$noCast === true
            if (!noCast) {
              const fieldType = this.fieldTypeCaster.specToFieldType(
                spec,
                container[fieldName]
              )
              if (container[fieldName] != undefined) {
                // We only attempt to type cast if the type was specified, the value is not null and not undefined
                // - a type cast failure would result in an error which we do not want in the case of undefined or null
                // - these indicate no-value, and so there is nothing to cast
                if (fieldType && fieldType != SchemaTypes.Mixed) {
                  container[fieldName] = this.fieldTypeCaster.typeCast(
                    fieldType,
                    container[fieldName],
                    path
                  )
                }
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
            if (typeof construct === 'string' && constructors[construct]) {
              constructorFunction = constructors[construct]
            } else if (typeof construct === 'function') {
              constructorFunction = construct
            } else {
              // constructor not found
              throw new Error(
                `Constructor "${construct}" not found for path "${path}" in schema ${schemaName}`
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

  /**
   * Strip transients from an object
   *
   * Removes:
   * - Path references ($pathRef)
   * - Relations ($relation)
   *
   * @param object - The object to process
   * @param iterator - The schema iterator
   * @param iteratorType - Type of iteration (iterate or iteratePaths)
   * @returns The processed object
   */
  stripTransients(
    object: any,
    iterator: SchemaIterator,
    iteratorType?: string
  ): any {
    var iteratorType =
      iteratorType == 'iteratePaths' ? 'iteratePaths' : 'iterate'
    var deleteRefs = []
    var result = object
      ? iterator[iteratorType](object, (opts) => {
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

  /**
   * Strip functions from an object recursively
   *
   * Removes all function properties from objects and arrays
   * @param obj - The object to process
   * @returns The object without functions
   */
  stripFunctions(obj: any): any {
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
}

export default SchemaTransientProcessor
