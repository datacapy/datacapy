import { ServerApiConfig } from '../api-config'
import { ApiConfigRegistryInterface } from './interfaces'

/**
 * Responsible for API configuration storage
 * Follows Single Responsibility Principle
 */
export class ApiConfigRegistry implements ApiConfigRegistryInterface {
  private apiConfigs: Array<ServerApiConfig>

  constructor() {
    this.apiConfigs = []
  }

  addApiConfig(config: ServerApiConfig): void {
    this.apiConfigs.push(config)
  }

  addApiConfigs(configs: Array<ServerApiConfig>): void {
    this.apiConfigs = this.apiConfigs.concat(configs)
  }

  getApiConfigs(): ServerApiConfig[] {
    return this.apiConfigs
  }
}
