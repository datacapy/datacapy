import { FilterAbstract } from './filter-abstract'

export class FilterCallback extends FilterAbstract {
  filter(value: any, options?) {
    var filter = options
    if (typeof filter == 'function') value = filter(value)
    return value
  }

  getName() {
    return 'callback'
  }
}

export default FilterCallback
