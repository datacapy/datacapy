import ObjectPathAccessor from '../utilities/object-path-accessor'

/**
 * Compares the value with another field of the root object, addressed by a
 * dotted `path`. The comparison is against the raw, unfiltered sibling value.
 * A missing `path` is a misconfiguration and fails validation.
 */
export class ValidatorEquality {
  validate(value: any, options?) {
    const name = options && options.label ? options.label : 'field'
    const root = options && options.root ? options.root : {}
    const path = options && options.path ? options.path : null
    const message =
      options && options.message ? options.message : name + ' does not match'
    const result =
      path && ObjectPathAccessor.getPath(path, root) === value ? true : message
    return result
  }

  getName() {
    return 'equality'
  }
}

export default ValidatorEquality
