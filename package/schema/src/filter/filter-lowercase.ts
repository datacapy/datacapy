import { FilterAbstract } from './filter-abstract'

export class FilterLowercase extends FilterAbstract {
  filter(value: any, _options?) {
    if (typeof value == 'string') value = value.toLowerCase()
    return value
  }

  getName() {
    return 'lowercase'
  }
}

export default FilterLowercase
