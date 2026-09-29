import { FilterAbstract } from './filter-abstract'

export class FilterTrim extends FilterAbstract {
  filter(value: any, _options?) {
    if (typeof value == 'string') value = value.trim()
    return value
  }

  getName() {
    return 'trim'
  }
}

export default FilterTrim
