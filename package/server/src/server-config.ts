import { ModelManagerConfig } from '@datacapy/om'

export interface ServerConfig {
  path: string
  port?: number
  appDir?: string
  /** The HTTP framework to run on. Default `express`; `hono` needs the optional peers. */
  adaptor?: 'express' | 'hono'
  model?: ModelManagerConfig
  [key: string]: any // Any custom config options
}

export default ServerConfig
