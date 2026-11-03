export type ConstructorRef = Function | string

/**
 * A `$construct` / `$constructCollection` value may be a class, a registered
 * name, or a thunk (`() => Survey`) that breaks an import cycle. A class has a
 * `prototype`; an arrow function does not.
 */
export function resolveConstructor(ref: ConstructorRef | undefined) {
  return typeof ref === 'function' && !('prototype' in ref)
    ? (ref as () => ConstructorRef | undefined)()
    : ref
}
