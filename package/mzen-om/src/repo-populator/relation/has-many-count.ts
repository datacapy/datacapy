import { Repo } from 'repo'
import { RelationConfig } from 'repo-populator'
import { RelationAbstract } from './abstract'

export class RelationHasManyCount extends RelationAbstract {
  async populate(relationRepo: Repo<any>, config: RelationConfig, docs) {
    config = this.normalizeConfig(config)

    const key = config.key ? config.key : '_id'

    const relationIds = this.getRelationIds(config, docs)

    if (relationIds.length == 0) return docs

    config.query[key] = { $in: relationIds }

    var groupCounts = await relationRepo.groupCount([key], config.query)

    var values: {
      [key: string]: number
      [key: number]: number
    } = {}
    groupCounts.forEach((groupCount) => {
      const value = groupCount._id[key]
      values[value] = groupCount.count
    })

    return this.populateValues(config, docs, values, relationRepo)
  }
}

export default RelationHasManyCount
