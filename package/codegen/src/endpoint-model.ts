import { TagValue } from './field-model'

/** The JS constructor `data.type` is written as; the request parser casts to it. */
export type DataType = 'String' | 'Number' | 'Boolean' | 'Array'

export type DataSource = 'param' | 'query' | 'body' | 'header' | 'config' | 'request' | 'container'

/** One `data` entry: a property of the service method's params object. */
export interface DataEntry {
  name: string
  src: DataSource
  /** Header name or dotted path; omitted when it equals `name`. */
  srcPath: string | null
  required: boolean
  type: DataType | null
  defaultValue: TagValue | undefined
}

export interface AclRule {
  allow: boolean
  role: string
}

export interface ErrorResponse {
  errorClass: string
  code: number
}

/** One endpoint: a service method with a `@route`. */
export interface RouteModel {
  /** Key in `endpoints`; the method name unless `@endpoint` says otherwise. */
  key: string
  method: string
  verbs: string[]
  /** Null defers to the server's own default (the method name). */
  path: string | null
  data: DataEntry[]
  rules: AclRule[]
  enable: boolean
  errors: ErrorResponse[]
}

/** A service class carrying the `@endpoints` marker. */
export interface ServiceModel {
  className: string
  serviceName: string
  /** Null derives `/<kebab-service-name>` in the server. */
  path: string | null
  routes: RouteModel[]
}
