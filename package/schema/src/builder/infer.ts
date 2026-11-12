import type { BuilderBase } from './builder-base'

/** Flattens an intersection into one readable object type. */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * The value type of one builder: its base type, plus `null` after `nullable()`.
 * A plain `SchemaSpec` object carries no type information, so it infers `any`.
 */
export type InferValue<B> = B extends { readonly _type: infer T }
  ? B extends { readonly _nullable: true }
    ? T | null
    : T
  : any

type IsPresent<B> = B extends { readonly _optional: true }
  ? false
  : B extends { readonly _present: true }
    ? true
    : false

/**
 * Object type for a schema spec (a map of field name to builder). A key is required
 * only when its builder went through `required()` or `default()` and not `optional()`.
 */
export type InferSpec<S> =
  HasMatchAll<S> extends true
    ? { [key: string]: InferValue<S[Extract<'*', keyof S>]> }
    : InferNamedSpec<S>

/**
 * True when `S` declares the `'*'` match-all key and has a closed set of keys.
 * `any` and index-signature specs (`SpecInput`) are not match-all specs.
 */
type HasMatchAll<S> =
  IsAny<S> extends true
    ? false
    : string extends keyof S
      ? false
      : '*' extends keyof S
        ? true
        : false

type InferNamedSpec<S> = Simplify<
  {
    -readonly [
      K in keyof S as IsPresent<S[K]> extends true ? K : never
    ]: InferValue<S[K]>
  } & {
    -readonly [
      K in keyof S as IsPresent<S[K]> extends true ? never : K
    ]?: InferValue<S[K]>
  }
>

/**
 * The plain-data form of a type: what a query result or JSON payload holds
 * before a constructor wraps it. Methods are dropped, recursively; `any` stays `any`.
 */
export type Plain<T> = 0 extends 1 & T
  ? T
  : T extends Date | string | number | boolean | bigint | null | undefined
    ? T
    : T extends (...args: never[]) => unknown
      ? never
      : T extends readonly (infer U)[]
        ? Plain<U>[]
        : T extends object
          ? Simplify<{
              [
                K in keyof T as T[K] extends (...args: never[]) => unknown
                  ? never
                  : K
              ]: Plain<T[K]>
            }>
          : T

/**
 * The raw data a constructor accepts: every key optional and nullable (`null`
 * and `undefined` both fill from a default), constructed fields in plain-data
 * form or as the instance itself,.
 * The instance type stays `InferSpec`.
 */
export type InferInputSpec<S> = Simplify<{
  -readonly [K in keyof S]?: Plain<InferValue<S[K]>> | InferValue<S[K]> | null
}>

/** Anything that can appear as one field of a schema spec. */
export type FieldInput = BuilderBase | Record<string, any>

/** A schema spec made of builders: field name to builder (or plain spec). */
export type SpecInput = { [key: string]: FieldInput }

/** Carries the schema spec type of a `Schema` or `BuilderSchema`. */
export interface HasSpec<S = any> {
  readonly _spec: S
}

/** A lazy schema reference, so definition order and module cycles do not matter. */
export type SchemaThunk<S = any> = () => HasSpec<S> & { getName(): string }

/**
 * Infer the data type from a `Schema` (instance or class), a `BuilderSchema`, a
 * schema spec made of builders, or a single builder.
 */
export type Infer<X> =
  X extends HasSpec<infer S>
    ? InferSpec<S>
    : X extends BuilderBase
      ? InferValue<X>
      : InferSpec<X>

/**
 * The presence and null markers of a builder, carried over when a
 * method returns a builder with a new value type (`shape()`, `of()`, `as()`).
 */
export type Markers<
  B extends { _present: unknown; _nullable: unknown; _optional: unknown },
> = Pick<B, '_present' | '_nullable' | '_optional'>

/** True for `any`. */
export type IsAny<T> = 0 extends 1 & T ? true : false

/** A schema that kept the builders it was made from, so defaults can be read. */
export interface HasBuilderFields<S = any> {
  builderFields(): S
}
