import type { Infer, InferSpec } from '../builder/infer'

/** Key prefix of every tag property. */
type TagKey = `$dc:${string}`

/**
 * An interface with its tags removed: the plain data type the tags annotate.
 * `string & Trim` becomes `string`, a literal union keeps its members, and
 * objects and arrays are stripped recursively. `Date` stays `Date`. A tagged
 * literal (`'a' & Default<'a'>`) cannot be stripped, because a primitive has no
 * tag key to remove, so it is kept as is and compared by {@link Same}.
 */
export type Untag<T> = T extends Date
  ? Date
  : T extends string
    ? string extends T
      ? string
      : T extends `${infer L}`
        ? L
        : T
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends null | undefined
          ? T
          : T extends readonly (infer U)[]
            ? Untag<U>[]
            : T extends object
              ? { [K in keyof T as K extends TagKey ? never : K]: Untag<T[K]> }
              : T

/** The type a schema spec must infer to for the interface `T`. */
export type SpecFor<T> = Untag<T>

type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/**
 * Exact equality, or each-way assignment when the types are only different
 * spellings. A tagged literal union is not identical to the plain union but is
 * assignable both ways, while a wrong or missing literal is not.
 */
type Same<A, B> = Equal<A, B> extends true ? true : Mutual<A, B>

/** `true` when `InferSpec<S>` is exactly the untagged interface `T`. */
export type SpecMatches<S, T> = Same<InferSpec<S>, SpecFor<T>>

/**
 * Compile-time exactness check for a hand-written (or generated) spec against
 * an interface. Resolves to `true`, or to an error object naming the problem:
 *
 *   type _ = AssertSpec<typeof spec, NoteData>
 *   const _check: _ = true   // fails to compile on drift
 */
export type AssertSpec<S, T> =
  SpecMatches<S, T> extends true
    ? true
    : {
        error: 'schema spec does not match the interface'
        spec: InferSpec<S>
        expected: SpecFor<T>
      }

/**
 * Same check for a schema class or instance type, as the generator emits:
 *
 *   const _check: AssertSchema<SchemaNote, NoteData> = true
 */
export type AssertSchema<X, T> =
  Same<Infer<X>, SpecFor<T>> extends true
    ? true
    : {
        error: 'schema does not match the interface'
        schema: Infer<X>
        expected: SpecFor<T>
      }
