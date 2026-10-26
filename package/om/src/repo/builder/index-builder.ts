import { IndexOptions, TypeHintValue } from 'data-source/interface'
import { RepoIndexConfig } from '../index-config'
import { TYPE_HINT_TIMESTAMP } from '../type-hints'
import { RepoConfigBuilder } from './builder-base'

/**
 * Builds a `RepoIndexConfig`. The index name is the key the builder is stored under in the
 * repo's `indexes` config, so it is not set here.
 *
 *   indexes: {
 *     createdAt: repib.desc('createdAt').timestamp(),
 *     email: repib.asc('email').unique(),
 *   }
 */
export class RepoIndexBuilder extends RepoConfigBuilder<RepoIndexConfig> {
  private spec: { [field: string]: number | string } = {}
  private options: IndexOptions = {}

  static asc(field: string): RepoIndexBuilder {
    return new RepoIndexBuilder().asc(field)
  }

  static desc(field: string): RepoIndexBuilder {
    return new RepoIndexBuilder().desc(field)
  }

  static text(field: string): RepoIndexBuilder {
    return new RepoIndexBuilder().text(field)
  }

  static geo2dsphere(field: string): RepoIndexBuilder {
    return new RepoIndexBuilder().geo2dsphere(field)
  }

  asc(field: string): this {
    this.spec[field] = 1
    return this
  }

  desc(field: string): this {
    this.spec[field] = -1
    return this
  }

  text(field: string): this {
    this.spec[field] = 'text'
    return this
  }

  geo2dsphere(field: string): this {
    this.spec[field] = '2dsphere'
    return this
  }

  unique(): this {
    this.options.unique = true
    return this
  }

  sparse(): this {
    this.options.sparse = true
    return this
  }

  expireAfterSeconds(seconds: number): this {
    this.options.expireAfterSeconds = seconds
    return this
  }

  lowercase(): this {
    this.options.lowercase = true
    return this
  }

  /**
   * Without fields the hint applies to every indexed field. With fields it applies to just
   * those, and repeated calls accumulate into the per-field map.
   */
  typeHint(hint: TypeHintValue, ...fields: string[]): this {
    if (fields.length === 0) {
      this.options.typeHint = hint
      return this
    }
    const current = this.options.typeHint
    const perField = typeof current === 'object' && current ? current : {}
    for (const field of fields) perField[field] = hint
    this.options.typeHint = perField
    return this
  }

  // Date-typed index fields need this hint or MySQL range queries compare lexicographically
  timestamp(...fields: string[]): this {
    return this.typeHint(TYPE_HINT_TIMESTAMP, ...fields)
  }

  build(): RepoIndexConfig {
    const config: RepoIndexConfig = { spec: { ...this.spec } }
    if (Object.keys(this.options).length > 0)
      config.options = { ...this.options }
    return config
  }
}

export const repib = RepoIndexBuilder
