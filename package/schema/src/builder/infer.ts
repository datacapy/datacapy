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
 * Object type for a shape (a map of field name to builder). A key is required
 * only when its builder went through `required()` or `default()` and not `optional()`.
 */
export type InferShape<S> = Simplify<
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

/** Anything that can appear as one field of a shape. */
export type FieldInput = BuilderBase | Record<string, any>

/** A shape: field name to builder (or plain spec). */
export type ShapeInput = { [key: string]: FieldInput }

/** Carries the shape type of a `Schema` or `BuilderSchema`. */
export interface HasShape<S = any> {
  readonly _shape: S
}

/** A lazy schema reference, so definition order and module cycles do not matter. */
export type SchemaThunk<S = any> = () => HasShape<S> & { getName(): string }

/**
 * Infer the data type from a shape, a `Schema`, a `BuilderSchema` or a single
 * builder.
 */
export type Infer<X> =
  X extends HasShape<infer S>
    ? InferShape<S>
    : X extends BuilderBase
      ? InferValue<X>
      : InferShape<X>

/**
 * The presence and null markers of a builder, carried over when a
 * method returns a builder with a new value type (`shape()`, `of()`, `as()`).
 */
export type Markers<
  B extends { _present: unknown; _nullable: unknown; _optional: unknown },
> = Pick<B, '_present' | '_nullable' | '_optional'>

/** True for `any`. */
export type IsAny<T> = 0 extends 1 & T ? true : false
