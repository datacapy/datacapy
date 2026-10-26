/**
 * Base class for repo config builders (`repib`, `relb`). A repo accepts a builder wherever it
 * accepts the plain config the builder produces, and calls `build()` itself.
 */
export abstract class RepoConfigBuilder<T> {
  abstract build(): T
}
