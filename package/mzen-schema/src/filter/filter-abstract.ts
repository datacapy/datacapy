export interface FilterConfig {
  allowMultiple: boolean
}

export abstract class FilterAbstract {
  abstract filter(value: any, options?): boolean | [string]
  abstract getName(): string

  getConfig(): FilterConfig {
    return { allowMultiple: true }
  }
}

export default FilterAbstract
