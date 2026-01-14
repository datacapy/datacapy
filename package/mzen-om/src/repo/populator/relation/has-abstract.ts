import { Repo } from 'repo'
import { RelationConfig } from 'repo/populator'
import { RelationAbstract } from './abstract'

export abstract class RelationHasAbstract extends RelationAbstract {
  async has(relationRepo: Repo<any>, config: RelationConfig, docs) {
    config = this.normalizeConfig(config)

    // Get normalized keys (works for both single and composite)
    const keys = this.getNormalizedKeys(config)

    // Get composite IDs from source documents
    const compositeIds = this.getCompositeRelationIds(config, docs)

    if (compositeIds.length === 0) {
      // continue to populate to apply transients
      return this.populateValues(config, docs, {}, relationRepo)
    }

    // Build optimized query for composite keys
    // For hasMany: keys map from source (parent) to target (related)
    // Detects constant fields and uses $in for variant fields to minimize $or clauses
    const optimizedQuery = this.buildOptimizedCompositeQuery(compositeIds, keys)
    Object.assign(config.query, optimizedQuery)

    const targetFields = Object.values(keys)

    // @ts-ignore - Expected 0 arguments, but got 2 - variable method arguments
    var relatedDocs: Record<string, any>[] = await relationRepo.find(
      config.query,
      config
    )
    if (config.filterPrivate && relationRepo.schema) {
      relatedDocs = relationRepo.schema.filterPrivate(relatedDocs, 'read')
    }

    // Group related docs by composite key
    var values = {}
    relatedDocs.forEach((relatedDoc) => {
      const compositeKey = this.createCompositeKey(relatedDoc, targetFields)
      if (values[compositeKey] === undefined) values[compositeKey] = []
      values[compositeKey].push(relatedDoc)
    })

    return this.populateValues(config, docs, values, relationRepo)
  }
}

export default RelationHasAbstract
