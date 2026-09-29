import { Repo } from 'repo'
import { RelationConfig } from 'repo/populator'
import { RelationAbstract } from './abstract'

export abstract class RelationBelongsToAbstract extends RelationAbstract {
  async belongsTo(
    relationRepo: Repo<any>,
    config: RelationConfig,
    docs: Record<string, any>[]
  ): Promise<Record<string, any>[]> {
    config = this.normalizeConfig(config)

    // Get normalized keys (works for both single and composite)
    const keys = this.getNormalizedKeys(config)

    // Get composite IDs from source documents
    const compositeIds = this.getCompositeRelationIds(config, docs)

    if (compositeIds.length === 0) {
      return this.populateValues(config, docs, {}, relationRepo)
    }

    // Build optimized query for composite keys
    // For belongsTo: keys map from source (current) to target (related)
    // Detects constant fields and uses $in for variant fields to minimize $or clauses
    const optimizedQuery = this.buildOptimizedCompositeQuery(compositeIds, keys)
    Object.assign(config.query, optimizedQuery)

    const targetFields = Object.values(keys)
    this.ensureFieldsIncludeKeys(config, targetFields)

    const relatedDocs = await relationRepo.find(config.query, config)

    const filteredDocs =
      config.filterPrivate && relationRepo.schema
        ? relationRepo.schema.filterPrivate(relatedDocs, 'read')
        : relatedDocs

    // Group by composite key (for belongsToOne, each composite key maps to one doc)
    const values: Record<string, any> = {}
    filteredDocs.forEach((relatedDoc) => {
      const compositeKey = this.createCompositeKey(relatedDoc, targetFields)
      values[compositeKey] = relatedDoc
    })

    return this.populateValues(config, docs, values, relationRepo)
  }
}

export default RelationBelongsToAbstract
