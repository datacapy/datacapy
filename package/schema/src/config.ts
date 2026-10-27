import Schema from './schema'
import { SchemaEncryptionService } from './encryption/encryption-service'

export interface SchemaConfig {
  name?: string
  spec?: any
  strict?: boolean
  constructors?: { [key: string]: any } | Array<any>
  schemas?: { [key: string]: Schema } | Array<Schema>
  defaultNotNull?: boolean
  skipTransients?: boolean
  encryptionService?: SchemaEncryptionService
  /** Max elements of any array or keys of any object during validation. Default 10,000. */
  maxCollectionSize?: number
  /** Max fields visited in one validate call. Default 1,000,000. */
  maxNodes?: number
  /** Max "Field not specified" errors reported per object in strict mode. Default 100. */
  maxFieldErrors?: number
}

export default SchemaConfig
