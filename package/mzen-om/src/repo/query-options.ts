import { QuerySelectionOptions } from 'data-source/interface'
import { DataSourceContext } from 'data-source/context'

export interface RepoQueryOptions extends QuerySelectionOptions {
  populate?: { [key: string]: boolean } | boolean
  filterPrivate?: boolean
  // mzen query validator can not handle complex queries
  // - some times the only option is to skip query validation
  skipValidation?: boolean
  // Context for dynamic datasource resolution
  context?: DataSourceContext
  [key: string]: any // allow implementation specific props
}
