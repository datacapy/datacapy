import Validator from '../validator/validator'
import SchemaUtility from '../utilities/utility'
import SchemaTypes from '../types'
import SchemaSpec from '../spec'
import SchemaConfig from '../config'
import { SchemaValidationMeta } from '../schema'
import { SchemaIteratorMeta } from '../iterator'
import SchemaFieldFilter from './field-filter'
import SchemaFieldTypeCaster from './field-type-caster'
import TypeCaster from '../utilities/type-caster'

/**
 * Interface for SchemaFieldValidator
 * Handles field-level validation orchestration
 */
export interface SchemaFieldValidatorInterface {
  /**
   * Validate a single field according to its specification
   * @param opts - Field validation options
   * @returns The validated (and potentially filtered) value
   */
  validateField(opts: {
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
 * SchemaFieldValidator
 *
 * Orchestrates field validation operations including:
 * - Validator registry execution
 * - $or operator validation (tries each spec in priority order)
 * - Match-all '*' spec validation
 * - Strict mode enforcement
 * - Error accumulation and reporting
 * - Coordination with SchemaFieldFilter for filtering
 *
 * This class coordinates with:
 * - Validator: Registry of validation implementations
 * - SchemaFieldFilter: For applying filters during validation
 * - SchemaFieldTypeCaster: For type resolution and validation
 */
export class SchemaFieldValidator implements SchemaFieldValidatorInterface {
  private fieldFilter: SchemaFieldFilter
  private fieldTypeCaster: SchemaFieldTypeCaster
  private config: SchemaConfig

  constructor(
    config: SchemaConfig,
    fieldTypeCaster: SchemaFieldTypeCaster,
    fieldFilter: SchemaFieldFilter
  ) {
    this.config = config
    this.fieldTypeCaster = fieldTypeCaster
    this.fieldFilter = fieldFilter
  }

  /**
   * Validate a single field according to its specification
   *
   * Handles:
   * - $or operator validation (tries each spec in priority order, prefers exact type matches)
   * - Field name validation
   * - Type resolution and validation
   * - Filter application via SchemaFieldFilter
   * - Match-all '*' spec for objects (validates all properties)
   * - Strict mode enforcement (ensures no undefined fields)
   * - Validator registry execution
   * - Error accumulation
   *
   * @param opts - Field validation options including spec, value, path, etc.
   * @returns The validated value (potentially filtered and type-casted)
   */
  async validateField(opts: {
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
              this.appendError(meta, path, `  [Option ${index + 1}] ${error}`)
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
      this.appendError(meta, path, 'Invalid field name')
    }

    const fieldType = this.fieldTypeCaster.specToFieldType(spec, value)

    // Apply filters
    value = await this.fieldFilter.filterField(opts)

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
          this.appendError(meta, fieldName, 'Field not specified')
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
        this.appendError(meta, path, result)
      })
    }

    return value
  }

  /**
   * Append an error to the validation metadata
   * @param meta - Validation metadata
   * @param path - The field path
   * @param error - The error message
   */
  private appendError(
    meta: SchemaValidationMeta,
    path: string | number,
    error: string
  ) {
    var errors = Array.isArray(meta.errors[path]) ? meta.errors[path] : []
    errors.push(error)
    meta.errors[path] = errors
  }
}

export default SchemaFieldValidator
