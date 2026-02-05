export interface SchemaSpec {
  $type?: any
  $spec?: SchemaSpec
  $or?: SchemaSpec[]
  $pathRef?: string
  $construct?: Function | string
  $constructCollection?: Function | string
  $filter?: SchemaSpecFilter
  $validate?: SchemaSpecValidate
  $label?: string
  $strict?: boolean
  // The nullable flag indicates that an object can have a null value
  // All other non array values can be null regardless
  // - unless specifically configured as notNull via $validate config
  $nullable?: boolean
  // Disable type casting for this field and all nested fields
  // - When true, values are stored as-is without type conversion
  // - Inherits down the tree unless explicitly set to false on a nested field
  $noCast?: boolean
  [key: string]: SchemaSpec | any
}

export interface SchemaSpecFilter {
  trim?: boolean
  uppercase?: boolean
  lowercase?: boolean
  defaultValue?: any
  callback?: (value: any) => boolean | string
  private?: boolean
  privateValue?: boolean
}

/**
 * Custom validator function type.
 * @param value - The value being validated
 * @param options - Validation options including root object and label
 * @returns true if valid, or error message string(s) if invalid
 */
export type CustomValidatorFn = (
  value: any,
  options: { root?: any; label?: string }
) => boolean | string | string[] | Promise<boolean | string | string[]>

export interface SchemaSpecValidateOptionsCallback
  extends SchemaSpecValidateOptions {
  validator: CustomValidatorFn
}

export interface SchemaSpecValidate {
  notNull?: boolean | SchemaSpecValidateOptions
  required?: boolean | SchemaSpecValidateOptions
  notEmpty?: boolean | SchemaSpecValidateOptions
  isEmpty?: boolean | SchemaSpecValidateOptions
  email?: boolean | SchemaSpecValidateOptions
  valueLength?: SchemaSpecValidateOptionsValueLength
  equality?:
    | SchemaSpecValidateOptionsEquality
    | Array<SchemaSpecValidateOptionsEquality>
  inArray?: SchemaSpecValidateOptionsInArray
  regex?: SchemaSpecValidateOptionsRegex | Array<SchemaSpecValidateOptionsRegex>
  callback?:
    | SchemaSpecValidateOptionsCallback
    | Array<SchemaSpecValidateOptionsCallback>
}

export interface SchemaSpecValidateOptions {
  name?: string
  message?: string
}

export interface SchemaSpecValidateOptionsValueLength
  extends SchemaSpecValidateOptions {
  min?: number
  max?: number
}

export interface SchemaSpecValidateOptionsEquality
  extends SchemaSpecValidateOptions {
  path: string
  root: any
}

export interface SchemaSpecValidateOptionsInArray
  extends SchemaSpecValidateOptions {
  values?: Array<any>
}

export interface SchemaSpecValidateOptionsRegex
  extends SchemaSpecValidateOptions {
  pattern?: any
}

export default SchemaSpec
