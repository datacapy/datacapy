// Type-only tags that describe schema rules on a TypeScript interface. A code
// generator reads them; nothing here exists at runtime. Each tag is an optional
// phantom property with a unique `$dc:` key, so a plain value stays assignable
// to a tagged type (`const s: string & Trim = 'x'` compiles) and tags combine
// with `&`.

/** The empty-object value of `Default`, spelled as a type. */
export type EmptyObject = Record<string, never>

/** The empty-array value of `Default`, spelled as a type. */
export type EmptyArray = readonly []

/** A plain object of literals, usable as the value of `Default` or `Init`. */
export type ObjectValue = {
  readonly [key: string]: string | number | boolean | null | ObjectValue
}

/** An array of literals, usable as the value of `Default` or `Init`: `Default<['en']>`. */
export type ArrayValue = readonly (
  string | number | boolean | null | ObjectValue
)[]

/** Value used when the field is missing (`default()`). `null` also makes it nullable. */
export type Default<
  V extends
    string | number | boolean | null | EmptyObject | ObjectValue | ArrayValue,
> = {
  readonly '$dc:default'?: V
}
/** Value set once on insert (`init()`). */
export type Init<
  V extends
    string | number | boolean | null | EmptyObject | ObjectValue | ArrayValue,
> = {
  readonly '$dc:init'?: V
}
/** `init()` with a function looked up by name in the registry's `initialisers`. */
export type InitFn<Name extends string> = { readonly '$dc:initFn'?: Name }
/** `default()` with a function looked up by name in the registry's `initialisers`. */
export type DefaultFn<Name extends string> = { readonly '$dc:defaultFn'?: Name }

/** `construct('Name')`: the constructor is looked up by name when the schema is used. */
export type Construct<Name extends string> = {
  readonly '$dc:construct'?: Name
}

/** `constructCollection(Name)` on an array; the collection class is looked up by name at runtime. */
export type ConstructCollection<Name extends string> = {
  readonly '$dc:constructCollection'?: Name
}

/** `required()` in addition to `Default` or `Init`, which otherwise stand in for it. */
export type Required = { readonly '$dc:required'?: true }
/** `inArray()` on a plain `string`, for when the TypeScript type is deliberately wider than the allowed values. */
export type OneOf<V extends string> = { readonly '$dc:oneOf'?: V }

/** `strict(false)` on an object: keys outside the shape are kept, not rejected. */
export type NonStrict = { readonly '$dc:nonStrict'?: true }
/**
 * An array or object stored as is and only typed: `sb.array().as<Item>()` or
 * `sb.object().as<T>()`. Nothing inside it is validated.
 */
export type Opaque = { readonly '$dc:opaque'?: true }

/** `email()` */
export type Email = { readonly '$dc:email'?: true }
/** `regex()`; the pattern is a string literal. */
export type Pattern<P extends string> = { readonly '$dc:pattern'?: P }
/** `minLength()` */
export type MinLength<N extends number> = { readonly '$dc:minLength'?: N }
/** `maxLength()` */
export type MaxLength<N extends number> = { readonly '$dc:maxLength'?: N }
/** `notEmpty()` */
export type NotEmpty = { readonly '$dc:notEmpty'?: true }
/** `notNull()`: rejects `null` where `required()` alone accepts it. */
export type NotNull = { readonly '$dc:notNull'?: true }

/** `trim()` */
export type Trim = { readonly '$dc:trim'?: true }
/** `lowercase()` */
export type Lowercase = { readonly '$dc:lowercase'?: true }
/** `uppercase()` */
export type Uppercase = { readonly '$dc:uppercase'?: true }
/** `stripHtml()` */
export type StripHtml = { readonly '$dc:stripHtml'?: true }

/** `private()` */
export type Private = { readonly '$dc:private'?: true }
/** `privateValue()` */
export type PrivateValue = { readonly '$dc:privateValue'?: true }
/** `encrypt()` */
export type Encrypt = { readonly '$dc:encrypt'?: true }
/** `label()` */
export type Label<L extends string> = { readonly '$dc:label'?: L }
/** `relation()` */
export type Relation = { readonly '$dc:relation'?: true }
/** `noCast()` */
export type NoCast = { readonly '$dc:noCast'?: true }

/** `validate()` with a callback looked up by name in the package's registry. */
export type Validate<Name extends string> = { readonly '$dc:validate'?: Name }
/** `filter()` with a callback looked up by name in the package's registry. */
export type Filter<Name extends string> = { readonly '$dc:filter'?: Name }
