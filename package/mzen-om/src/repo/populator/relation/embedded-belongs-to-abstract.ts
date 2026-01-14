import { Repo } from 'repo'
import { RelationConfig } from 'repo/populator'
import { RelationEmbeddedAbstract } from './embedded-abstract'

export abstract class RelationEmbeddedBelongsToAbstract extends RelationEmbeddedAbstract {
  async embeddedBelongsTo(
    relationRepo: Repo<any>,
    config: RelationConfig,
    docs
  ) {
    config = this.normalizeConfig(config)

    const pkey = config.pkey ? config.pkey : '_id'

    // Since this is an embedded relation, we are looking up relations ids using
    // - a simple indexOf() rather than a DB query, cast ids to string to esnure objects
    // - are matched based on value rather than object reference
    const relationIds = this.getRelationIds(config, docs).map((id) =>
      String(id)
    )
    if (relationIds.length == 0) {
      return this.populateValues(config, docs, {}, relationRepo)
    }

    const embeddedDocs = this.getEmebedRelations(config.docPathRelated, docs)

    var values = {}
    embeddedDocs.forEach((embeddedDoc) => {
      // We must store the id as a primitive so we can use it as a object field name in our lookup values object
      // - complex types can not be used as object field names
      let id = String(embeddedDoc[pkey])
      if (relationIds.indexOf(id) != -1) {
        // Group related docs by parent key
        values[id] = embeddedDoc
      }
    })

    return this.populateValues(config, docs, values, relationRepo)
  }
}

export default RelationEmbeddedBelongsToAbstract
