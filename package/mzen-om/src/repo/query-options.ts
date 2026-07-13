import { QuerySelectionOptions } from 'data-source/interface'
import { DataSourceContext } from 'data-source/context'

export interface RepoQueryOptions extends QuerySelectionOptions {
  populate?: { [key: string]: boolean } | boolean
  filterPrivate?: boolean
  // mzen query validator can not handle complex queries
  // - some times the only option is to skip query validation
  skipValidation?: boolean
  // Include documents with a non null `deleted` field in find/count/update calls on a
  // soft-delete enabled repo (bypasses the automatically applied `deleted` exclusion filter)
  includeDeleted?: boolean
  // Force a real hard delete on a soft-delete enabled repo instead of the default
  // soft-delete behaviour (setting `deleted` rather than removing the document)
  forceHardDelete?: boolean
  // Context for dynamic datasource resolution
  context?: DataSourceContext
  [key: string]: any // allow implementation specific props
}
