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
}

export default SchemaConfig
