import TypeCaster from './type-caster'
import SchemaSpec from '../spec'

export class SchemaUtility {
  static getSpec(path: string, spec: SchemaSpec) {
    var spec = spec ? spec : ({} as SchemaSpec)
    var pathParts = path && path ? path.split('.') : []

    var currentPathPart = pathParts.shift()
    if (currentPathPart) {
      if (spec[currentPathPart]) {
        spec = spec[currentPathPart]
      } else if (spec['*']) {
        // Fallback to wildcard key if exact match not found
        spec = spec['*']
      } else {
        const partAsNumber = TypeCaster.cast(Number, currentPathPart)
        const partIsNumber =
          TypeCaster.getType(partAsNumber) == Number && !isNaN(partAsNumber)
        if (currentPathPart != '*' && partIsNumber == false) {
          // There is no spec defined for the given path
          // - and the path is not an array so there is no matching field config
          return undefined
        }
      }
    }

    if (pathParts.length) {
      const type = TypeCaster.getType(spec)
      if (type == Array && spec.length) {
        spec = spec[0]
      } else if (type == Object && spec['$spec']) {
        spec = spec['$spec']
      }
      spec = SchemaUtility.getSpec(pathParts.join('.'), spec)
    }

    return spec
  }

  static isValidFieldName(fieldName) {
    return Number.isInteger(fieldName) || !SchemaUtility.isOperator(fieldName)
  }

  static isOperator(fieldName) {
    return typeof fieldName == 'string' && fieldName.charAt(0) == '$'
  }

  static canValidateQueryOperator(fieldName) {
    // These operators take an operand that is not itself a value of the
    // field's type (e.g. $exists takes a boolean regardless of whether the
    // field is a Date, string, etc.) so their operand should not be
    // type-validated against the field's schema. $regex/$options are a
    // search pattern and its match flags respectively - neither has to
    // itself satisfy the field's own format validators (e.g. a substring
    // search pattern for a field with a `.regex()` format constraint, such
    // as a domain-shaped subdomain field, need not itself look like a
    // domain).
    var cantValidateOperators = ['$near', '$exists', '$regex', '$options']
    return cantValidateOperators.indexOf(fieldName) == -1
  }
}

export default SchemaUtility
