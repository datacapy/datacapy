export class ValidatorNotNull {
  validate(value: any, options?) {
    const isValid =
      value !== null &&
      !(
        // Opt-in: for callers whose input source has no real null (query strings, forms)
        options?.treatNullStringAsNull === true &&
        typeof value == 'string' &&
        value.toLowerCase() == 'null'
      )
    const name = options && options.label ? options.label : 'field'
    const message =
      options && options.message ? options.message : name + ' cannot be null'
    const result = isValid ? isValid : message
    return result
  }

  getName() {
    return 'notNull'
  }
}

export default ValidatorNotNull
