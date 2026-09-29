import Filter from '../filter/filter'
import SchemaTypes from '../types'
import SchemaSpec from '../spec'
import SchemaConfig from '../config'
import { SchemaValidationMeta } from '../schema'
import { SchemaIteratorMeta } from '../iterator'
import SchemaFieldTypeCaster from './field-type-caster'
import { genUniqueId } from '@datacapy/id'

/**
 * Interface for SchemaFieldFilter
 * Handles field-level filtering orchestration
 */
export interface SchemaFieldFilterInterface {
  /**
   * Filter a single field according to its specification
   * @param opts - Field filtering options
   * @returns The filtered value
   */
  filterField(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    fieldName: string | number
    value: any
    path: string | number
    config?: SchemaConfig
    meta?: SchemaValidationMeta
    mapperMeta?: SchemaIteratorMeta
  }): Promise<any>
}

/**
 * SchemaFieldFilter
 *
 * Orchestrates field filtering operations including:
 * - Applying default values
 * - Type casting after defaults
 * - Filter application from Filter registry
 * - $or operator filtering logic
 * - Match-all '*' spec filtering
 *
 * This class coordinates with:
 * - Filter: Registry of filter implementations
 * - SchemaFieldTypeCaster: For type casting after default values
 */
export class SchemaFieldFilter implements SchemaFieldFilterInterface {
  private fieldTypeCaster: SchemaFieldTypeCaster

  constructor(fieldTypeCaster: SchemaFieldTypeCaster) {
    this.fieldTypeCaster = fieldTypeCaster
  }

  /**
   * Filter a single field according to its specification
   *
   * Handles:
   * - $or operator filtering (tries each spec in priority order)
   * - Default value application
   * - Type casting (using SchemaFieldTypeCaster)
   * - Match-all '*' spec for objects
   * - Filter registry application
   *
   * @param opts - Field filtering options including spec, value, path, etc.
   * @returns The filtered value
   */
  async filterField(opts: {
    spec: SchemaSpec
    specParent: SchemaSpec
    fieldName: string | number
    value: any
    path: string | number
    config?: SchemaConfig
    meta?: SchemaValidationMeta
    mapperMeta?: SchemaIteratorMeta
  }): Promise<any> {
    var { spec, specParent, fieldName, value, path, config, meta, mapperMeta } =
      opts

    path = path ? path : fieldName
    config = config ? config : {}
    meta = meta ? meta : { errors: [] }
    mapperMeta = mapperMeta ? mapperMeta : {}

    // Handle $or operator - try each spec's filters in priority order
    if (spec && spec.$or && Array.isArray(spec.$or)) {
      // If $noCast is set, skip type casting entirely - just return the value as-is
      if (spec.$noCast === true) {
        return value
      }

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

    const fieldType = this.fieldTypeCaster.specToFieldType(spec, value)

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

    if (value != undefined && spec?.$noCast !== true) {
      // We only attempt to type cast if the type was specified, the value is not null and not undefined
      // - a type cast failure would result in an error which we do not want in the case of undefined or null
      // - these indicate no-value, and so there is nothing to cast
      // Skip type casting if $noCast is true
      if (fieldType && fieldType != SchemaTypes.Mixed)
        value = this.fieldTypeCaster.typeCast(fieldType, value, path, meta)
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
      // Inherit $noCast and $strict from parent spec
      const inheritedMatchAllSpec = {
        ...matchAllFilterSpec,
        ...(spec?.$noCast !== undefined &&
          matchAllFilterSpec.$noCast === undefined && {
            $noCast: spec.$noCast,
          }),
        ...(spec?.$strict !== undefined &&
          matchAllFilterSpec.$strict === undefined && {
            $strict: spec.$strict,
          }),
      }

      // Iterate through each property and apply the match-all spec
      for (const propName in value) {
        if (typeof value[propName] === 'function') continue

        const propValue = await this.filterField({
          spec: inheritedMatchAllSpec,
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
}

export default SchemaFieldFilter
