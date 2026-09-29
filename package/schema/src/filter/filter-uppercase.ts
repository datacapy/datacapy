import { FilterAbstract } from './filter-abstract'

export class FilterUppercase extends FilterAbstract {
  filter(value: any, _options?) {
    if (typeof value == 'string') value = value.toUpperCase()
    return value
  }

  getName() {
    return 'uppercase'
  }
}

export default FilterUppercase
