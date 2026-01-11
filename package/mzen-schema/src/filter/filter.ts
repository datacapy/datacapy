import { FilterAbstract } from './filter-abstract'
import { FilterCustom } from './filter-custom'
import { FilterDefaultValue } from './filter-default-value'
import { FilterLowercase } from './filter-lowercase'
import { FilterTrim } from './filter-trim'
import { FilterUppercase } from './filter-uppercase'
import { FilterPostcode } from './filter-postcode'
import { FilterStripHtml } from './filter-strip-html'

export class Filter {
  static filters = {}

  static async filter(value, filtersSpec) {
    var configKeys = Object.keys(filtersSpec)
    for (let x = 0; x < configKeys.length; x++) {
      let filterName = configKeys[x]
      let filter = this.filters[filterName]
      let config = (filter && filter.getConfig()) || {}

      // Ignore special filters
      const specialFilterNames = ['private', 'privateValue']
      if (specialFilterNames.indexOf(filterName) !== -1) continue

      if (!filter) throw new Error('Uknown filter "' + filterName + '"')

      let filterSpec = filtersSpec[filterName]
      // If filtersSpec is an array we run the validator multiple times
      // - one for each filtersSpec object
      filterSpec =
        config.allowMultiple && Array.isArray(filterSpec)
          ? filterSpec
          : [filterSpec]

      for (let y = 0; y < filterSpec.length; y++) {
        value = await Promise.resolve(filter.filter(value, filterSpec[y]))
      }
    }

    return value
  }

  static addFilter(handler: FilterAbstract, name?: string) {
    name = name ? name : handler.getName()
    this.filters[name] = handler
  }
}

Filter.addFilter(new FilterCustom())
Filter.addFilter(new FilterDefaultValue())
Filter.addFilter(new FilterLowercase())
Filter.addFilter(new FilterTrim())
Filter.addFilter(new FilterUppercase())
Filter.addFilter(new FilterPostcode())
Filter.addFilter(new FilterStripHtml())

export default Filter
