import { SchemaIterator, SchemaIteratorMeta } from '../iterator'
import TypeCaster from '../utilities/type-caster'
import SchemaSpec from '../spec'

/**
 * Interface for SchemaFieldPrivateFilter
 * Handles filtering of private/sensitive fields
 */
export interface SchemaFieldPrivateFilterInterface {
  /**
   * Filter private fields from an object
   * @param object - The object to filter
   * @param iterator - The schema iterator
   * @param mode - Filter mode (boolean or string for specific mode)
   * @param iteratorType - Type of iteration (iterate or iteratePaths)
   * @returns The filtered object
   */
  filterPrivate(
    object: any,
    iterator: SchemaIterator,
    mode?: boolean | string,
    iteratorType?: string
  ): any
}

/**
 * SchemaFieldPrivateFilter
 *
 * Filters private/sensitive fields from data structures based on access mode.
 *
 * Two types of private field handling:
 * 1. private: Completely removes the field from the object
 * 2. privateValue: Replaces the value with a boolean (true if value exists, false otherwise)
 *
 * Modes:
 * - true: Filter all fields marked as private
 * - false: Don't filter any fields
 * - "read"/"write"/"admin": Filter fields with matching mode
 *
 * This class coordinates with:
 * - SchemaIterator: For traversing the object structure
 */
export class SchemaFieldPrivateFilter implements SchemaFieldPrivateFilterInterface {
  /**
   * Filter private fields from an object
   *
   * Handles:
   * - Private field removal (private filter)
   * - Private value replacement (privateValue filter)
   * - Mode-based filtering (read/write/admin)
   * - Deferred deletion to avoid iteration issues
   *
   * @param object - The object to filter
   * @param iterator - The schema iterator
   * @param mode - Filter mode (true/false or specific mode like "read")
   * @param iteratorType - Type of iteration (iterate or iteratePaths)
   * @returns The filtered object
   */
  filterPrivate(
    object: any,
    iterator: SchemaIterator,
    mode?: boolean | string,
    iteratorType?: string
  ): any {
    mode = mode ? mode : true
    var deleteRefs = []
    var valueReplaceRefs = []
    var iteratorType =
      iteratorType == 'iteratePaths' ? 'iteratePaths' : 'iterate'
    var result = object
      ? iterator[iteratorType](object, (opts) => {
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
          // The shared iterator never descends into $or-composed fields'
          // children (validation intentionally handles those separately),
          // so a private()-flagged field nested inside an $or alternative
          // would otherwise never be visited at all. Redaction is scoped
          // narrowly here instead, matched-by-type against $or's
          // alternatives, rather than changing that shared skip.
          if (spec && spec.$or && container && container[fieldName] != null) {
            this.collectPrivateRefsInOrValue(
              container[fieldName],
              spec.$or,
              mode,
              iterator,
              deleteRefs,
              valueReplaceRefs
            )
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

  /**
   * Redacts private()-flagged fields nested inside an $or-composed value,
   * matching each alternative against the value's own runtime type (the
   * same resolution SchemaIterator#mapField uses for a plain spec) rather
   * than relying on a discriminator - if more than one alternative shares
   * that type, every one of them is walked, so a field private in any
   * matching alternative is redacted regardless of which one truly applies.
   */
  private collectPrivateRefsInOrValue(
    value: any,
    orAlternatives: SchemaSpec[],
    mode: boolean | string,
    iterator: SchemaIterator,
    deleteRefs: Array<{ container: any; fieldName: string | number }>,
    valueReplaceRefs: Array<{ container: any; fieldName: string | number }>
  ): void {
    const valueType = TypeCaster.getType(value)

    for (const altSpec of orAlternatives) {
      if (!altSpec || typeof altSpec !== 'object') continue

      let altType =
        altSpec.constructor == String ? altSpec : TypeCaster.getType(altSpec)
      if (altType == Object && (altSpec as SchemaSpec).$type !== undefined) {
        altType = (altSpec as SchemaSpec).$type
      }
      if (altType !== valueType) continue

      const resolvedSpec = (altSpec as SchemaSpec).$spec ?? altSpec

      iterator.mapField({
        spec: resolvedSpec as SchemaSpec,
        specParent: null,
        fieldName: 'value',
        container: { value },
        path: '',
        callback: (opts) => {
          const { spec: fieldSpec, fieldName, container } = opts
          const filters =
            fieldSpec && fieldSpec.$filter ? fieldSpec.$filter : {}
          if (filters.private === true || filters.private == mode) {
            if (container) deleteRefs.push({ container, fieldName })
          }
          if (filters.privateValue === true || filters.privateValue == mode) {
            if (container) valueReplaceRefs.push({ container, fieldName })
          }
        },
        config: {},
        meta: { errors: {} } as SchemaIteratorMeta,
      })
    }
  }
}

export default SchemaFieldPrivateFilter
