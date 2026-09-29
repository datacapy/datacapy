import { FilterAbstract } from './filter-abstract'
export class FilterDefaultValue extends FilterAbstract {
  filter(value: any, options?) {
    if (
      value === undefined ||
      FilterDefaultValue.isNull(value) ||
      (Array.isArray(value) && value.length === 0)
    ) {
      var defaultValue = options
      value = typeof defaultValue == 'function' ? defaultValue() : defaultValue
    }
    return value
  }

  static isNull(value) {
    var result =
      value === null ||
      // The string value NULL or null are treated as a literal null
      (typeof value == 'string' && value.toLowerCase() == 'null')

    return result
  }

  getName() {
    return 'defaultValue'
  }

  getConfig() {
    return { allowMultiple: false }
  }
}

export default FilterDefaultValue
