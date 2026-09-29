import { ModelManager } from '@datacapy/om'

import { ServerConfig } from '../server-config'
import {
  ConfigurationManagerInterface,
  LoggerInterface,
  ModelManagerInterface,
} from './interfaces'
import * as path from 'path'

/**
 * Responsible for server configuration normalization and validation
 * Follows Single Responsibility Principle
 */
export class ConfigurationManager implements ConfigurationManagerInterface {
  private config: ServerConfig
  private modelManager: ModelManagerInterface

  constructor(options?: ServerConfig, modelManager?: ModelManager) {
    // Normalize configuration with defaults
    this.config = options ? options : { path: '' }
    this.config.path = this.config.path ? this.config.path : '/api'
    this.config.port = this.config.port ? this.config.port : 3838
    // Default appDir directory is the same directory as the executed script
    this.config.appDir = this.config.appDir
      ? path.resolve(this.config.appDir)
      : ''

    // Create or use provided ModelManager
    this.modelManager = modelManager
      ? modelManager
      : new ModelManager(this.config.model ? this.config.model : undefined)
  }

  getConfig(): ServerConfig {
    return this.config
  }

  getModelManager(): ModelManagerInterface {
    return this.modelManager
  }

  setLogger(logger: LoggerInterface): void {
    this.modelManager.setLogger(logger)
  }
}
