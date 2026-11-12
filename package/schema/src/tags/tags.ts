// Type-only tags that describe schema rules on a TypeScript interface. A code
// generator reads them; nothing here exists at runtime. Each tag is an optional
// phantom property with a unique `$dc:` key, so a plain value stays assignable
// to a tagged type (`const s: string & Trim = 'x'` compiles) and tags combine
// with `&`.

/** Value used when the field is missing (`default()`). `null` also makes it nullable. `{}` is the empty object. */
export type Default<
  V extends string | number | boolean | null | Record<string, never>,
> = {
  readonly '$dc:default'?: V
}
/** Value set once on insert (`init()`). */
export type Init<V extends string | number | boolean | null> = {
  readonly '$dc:init'?: V
}
/** `init()` with a function looked up by name in the registry's `initialisers`. */
export type InitFn<Name extends string> = { readonly '$dc:initFn'?: Name }
/** `default()` with a function looked up by name in the registry's `initialisers`. */
export type DefaultFn<Name extends string> = { readonly '$dc:defaultFn'?: Name }

/** `constructCollection(Name)` on an array; the collection class is looked up by name at runtime. */
export type ConstructCollection<Name extends string> = {
  readonly '$dc:constructCollection'?: Name
}

/** `required()` in addition to `Default` or `Init`, which otherwise stand in for it. */
export type Required = { readonly '$dc:required'?: true }
/** `inArray()` on a plain `string`, for when the TypeScript type is deliberately wider than the allowed values. */
export type OneOf<V extends string> = { readonly '$dc:oneOf'?: V }

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
