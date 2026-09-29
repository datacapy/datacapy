export interface FilterConditionSpec {
  $regex?: RegExp
  $not?: FilterConditionSpec
}

export class FilterCondition {
  static evaluate(value: any, spec: FilterConditionSpec): boolean {
    if (spec.$not) return !this.evaluate(value, spec.$not)
    if (spec.$regex) return spec.$regex.test(String(value ?? ''))
    return true
  }
}

export default FilterCondition
