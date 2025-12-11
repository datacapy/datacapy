import { FilterAbstract } from './filter-abstract'

export class FilterCustom extends FilterAbstract {
  filter(value: any, options?) {
    var filter = options
    if (typeof filter == 'function') value = filter(value)
    return value
  }

  getName() {
    return 'custom'
  }
}

export default FilterCustom
