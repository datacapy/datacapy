import { FilterAbstract } from './filter-abstract'

export class FilterPrependHttp extends FilterAbstract {
  filter(value: any, _options?) {
    if (typeof value === 'string' && value.length > 0) value = 'http://' + value
    return value
  }

  getName() {
    return 'prependHttp'
  }
}

export default FilterPrependHttp
