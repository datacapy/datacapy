import ValidatorInterface from './validator-interface'

export class ValidatorCallback implements ValidatorInterface {
  // Callback validator allows you to specify your own validator function
  // - the function should return boolean true for a valid value
  // - or return an error message string or an array of error messages
  validate(value: any, options?) {
    const validator =
      options && options.validator ? options.validator : () => true
    return validator(value, options)
  }

  getName() {
    return 'callback'
  }
}

export default ValidatorCallback
