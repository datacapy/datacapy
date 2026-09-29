import { Repo } from 'repo'
import { RelationConfig } from 'repo/populator'
import { RelationEmbeddedAbstract } from './embedded-abstract'

export abstract class RelationEmbeddedHasAbstract extends RelationEmbeddedAbstract {
  async embeddedHas(relationRepo: Repo<any>, config: RelationConfig, docs) {
    config = this.normalizeConfig(config)

    const key = config.key ? config.key : '_id'

    // Since this is an embedded relation, we are looking up relations ids using
    // - a simple indexOf() rather than a DB query, cast ids to string to ensure objects
    // - are matched based on value rather than object reference
    const relationIds = this.getRelationIds(config, docs).map((id) =>
      String(id)
    )
    if (relationIds.length == 0) {
      this.populateValues(config, docs, {}, relationRepo)
    }

    const embeddedDocs = this.getEmbedRelations(config.docPathRelated, docs)

    var values = {}
    embeddedDocs.forEach(function (embeddedDoc) {
      if (relationIds.indexOf(embeddedDoc[key]) != -1) {
        if (values[embeddedDoc[key]] == undefined) values[embeddedDoc[key]] = []
        values[embeddedDoc[key]].push(embeddedDoc)
      }
    })

    return this.populateValues(config, docs, values, relationRepo)
  }
}

export default RelationEmbeddedHasAbstract
