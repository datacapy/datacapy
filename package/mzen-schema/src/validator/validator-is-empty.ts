import TypeCaster from '../type-caster'

export class ValidatorIsEmpty {
  validate(value: any, options?) {
    const label = options && options.label ? options.label : 'field'
    const message =
      options && options.message ? options.message : label + ' must be empty'

    const allowZero = options && (options.allowZero || options.permissive)
    const allowFalse = options && (options.allowFalse || options.permissive)

    const valueType =
      value !== null && value !== undefined
        ? TypeCaster.getType(value)
        : undefined

    const isZero = valueType === Number && value === 0
    const isFalse = valueType === Boolean && value === false
    const isEmptyString = valueType === String && value === ''

    const result =
      value == undefined ||
      (isZero && !allowZero) ||
      (isFalse && !allowFalse) ||
      isEmptyString ||
      (valueType == Number && isNaN(value)) ||
      (valueType == Object && Object.keys(value).length == 0) ||
      (valueType == Array && value.length == 0)
        ? true
        : message

    return result
  }

  getName() {
    return 'isEmpty'
  }
}

export default ValidatorIsEmpty
