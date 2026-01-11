import TypeCaster from './type-caster'
import SchemaTypes from './types'
import SchemaSpec from './spec'
import { SchemaValidationMeta } from './schema'

/**
 * Interface for SchemaFieldTypeCaster
 * Handles field-level type casting and type resolution from schema specifications
 */
export interface SchemaFieldTypeCasterInterface {
  /**
   * Cast a value to the required type with validation and error reporting
   * @param requiredType - The target type to cast to
   * @param value - The value to cast
   * @param path - The field path for error reporting
   * @param meta - Validation metadata for error accumulation
   * @returns The casted value
   */
  typeCast(
    requiredType: any,
    value: any,
    path?: string | number,
    meta?: SchemaValidationMeta
  ): any

  /**
   * Resolve the field type from a schema specification
   * @param spec - The schema specification
   * @param value - The current value (used for $or type resolution)
   * @returns The resolved type constructor
   */
  specToFieldType(spec: SchemaSpec, value: any): any
}

/**
 * SchemaFieldTypeCaster
 *
 * High-level field type orchestrator that handles:
 * - Resolving field types from schema specifications
 * - Orchestrating type casting with validation
 * - Error reporting for type conversion failures
 * - Support for $or operator type resolution
 *
 * This class is schema-aware and understands specifications, validators, and error paths.
 * It uses SchemaTypeCaster internally for the actual low-level type conversions.
 *
 * Difference from SchemaTypeCaster:
 * - SchemaTypeCaster: Low-level utility with static methods (getType, cast, etc.)
 * - SchemaFieldTypeCaster: Field-level orchestrator that works with schema specs
 */
export class SchemaFieldTypeCaster implements SchemaFieldTypeCasterInterface {
  /**
   * Resolve the field type from a schema specification
   *
   * Handles:
   * - String type names (e.g., "String", "Number")
   * - Constructor references (e.g., String, Number)
   * - $type specifications in spec objects
   * - $or operator with multiple type options (tries to match value type)
   *
   * @param spec - The schema specification
   * @param value - The current value (used for $or type resolution)
   * @returns The resolved type constructor or undefined
   */
  specToFieldType(spec: SchemaSpec, value: any): any {
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

  /**
   * Cast a value to the required type with validation and error reporting
   *
   * Handles:
   * - Type validation (checks if value is already the correct type)
   * - Type conversion using SchemaTypeCaster
   * - Error detection and reporting
   * - Special handling for Object and Array types
   * - NaN detection for number conversions
   *
   * @param requiredType - The target type to cast to
   * @param value - The value to cast
   * @param path - The field path for error reporting
   * @param meta - Validation metadata for error accumulation
   * @returns The casted value (or original value if casting failed)
   */
  typeCast(
    requiredType: any,
    value: any,
    path?: string | number,
    meta?: SchemaValidationMeta
  ): any {
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
          this.appendError(
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

export default SchemaFieldTypeCaster
