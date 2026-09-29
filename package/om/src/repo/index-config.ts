import { IndexOptions } from 'data-source/interface'

export interface RepoIndexConfig {
  // fieldname or {fieldA: 1, fieldB: -1} or {location: '2dsphere', description: 'text', otherField: 1}
  spec: { [key: string]: number | string } | string
  // boolean options indicates unique index; object-form typeHint maps per-field types for composite indexes
  options?: boolean | (IndexOptions & { [key: string]: any })
}
