import { RepoRelationConfig } from '../populator'
import { RepoConfigBuilder } from './builder-base'

/**
 * Builds a `RepoRelationConfig`. One static method per relation type, so the type string is
 * never written by hand. The alias defaults to the key the builder is stored under in the
 * repo's `relations` config.
 *
 *   import { RepoRelationBuilder as relb } from '@datacapy/server'
 *
 *   relations: {
 *     participant: relb.belongsToOne('surveyParticipant').key('participantId'),
 *     responses: relb.hasMany('surveyResponse').key('surveyId').autoPopulate(false),
 *   }
 */
export class RepoRelationBuilder extends RepoConfigBuilder<RepoRelationConfig> {
  private config: RepoRelationConfig

  private constructor(type: string, repo: string) {
    super()
    this.config = { repo, type }
  }

  static belongsToOne(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('belongsToOne', repo)
  }

  static belongsToMany(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('belongsToMany', repo)
  }

  static hasOne(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('hasOne', repo)
  }

  static hasMany(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('hasMany', repo)
  }

  static hasManyCount(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('hasManyCount', repo)
  }

  static embeddedBelongsToOne(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('embeddedBelongsToOne', repo)
  }

  static embeddedBelongsToMany(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('embeddedBelongsToMany', repo)
  }

  static embeddedHasOne(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('embeddedHasOne', repo)
  }

  static embeddedHasMany(repo: string): RepoRelationBuilder {
    return new RepoRelationBuilder('embeddedHasMany', repo)
  }

  key(key: string): this {
    this.config.key = key
    return this
  }

  // Composite keys: maps source fields to target fields
  keys(keys: { [sourceField: string]: string }): this {
    this.config.keys = keys
    return this
  }

  pkey(pkey: string): this {
    this.config.pkey = pkey
    return this
  }

  alias(alias: string): this {
    this.config.alias = alias
    return this
  }

  docPath(docPath: string): this {
    this.config.docPath = docPath
    return this
  }

  docPathRelated(docPathRelated: string): this {
    this.config.docPathRelated = docPathRelated
    return this
  }

  query(query: unknown): this {
    this.config.query = query
    return this
  }

  fields(fields: { [field: string]: number }): this {
    this.config.fields = fields
    return this
  }

  recursion(recursion: number): this {
    this.config.recursion = recursion
    return this
  }

  autoPopulate(autoPopulate: boolean = true): this {
    this.config.autoPopulate = autoPopulate
    return this
  }

  filterPrivate(filterPrivate: boolean = true): this {
    this.config.filterPrivate = filterPrivate
    return this
  }

  populate(populate: { [relation: string]: boolean } | boolean): this {
    this.config.populate = populate
    return this
  }

  limit(limit: number): this {
    this.config.limit = limit
    return this
  }

  skip(skip: number): this {
    this.config.skip = skip
    return this
  }

  sort(sort: { [field: string]: number }): this {
    this.config.sort = sort
    return this
  }

  build(): RepoRelationConfig {
    return { ...this.config }
  }
}
