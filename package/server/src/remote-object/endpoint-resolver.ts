import { ModelManagerInterface } from './interfaces'
import { ServerApiConfigEndpoint } from '../api-config'

/**
 * Converts camelCase to kebab-case
 * Example: 'surveyParticipant' -> 'survey-participant'
 */
function camelToKebab(input: string): string {
  return input ? input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() : ''
}

/**
 * Responsible for resolving endpoint objects and paths
 * Follows Single Responsibility Principle
 */
export class EndpointResolver {
  private defaultObject: any
  private modelManager?: ModelManagerInterface

  constructor(defaultObject: any, modelManager?: ModelManagerInterface) {
    this.defaultObject = defaultObject
    this.modelManager = modelManager
  }

  /**
   * Resolves the remote object for a specific endpoint
   * Priority: endpoint.object > endpoint.service > endpoint.repo > config-level object
   */
  resolveEndpointObject(endpointConfig: ServerApiConfigEndpoint): any {
    // Priority 1: Direct object instance
    if (endpointConfig.object) {
      return endpointConfig.object
    }

    // Priority 2: Service lookup
    if (endpointConfig.service) {
      return this.resolveService(endpointConfig.service)
    }

    // Priority 3: Repo lookup
    if (endpointConfig.repo) {
      return this.resolveRepo(endpointConfig.repo)
    }

    // Fallback: Use config-level object
    return this.defaultObject
  }

  /**
   * Resolve a service from the model manager
   */
  private resolveService(serviceName: string): any {
    if (!this.modelManager) {
      throw new Error(
        `Cannot resolve service "${serviceName}" - modelManager not provided to ServerRemoteObject`
      )
    }

    const serviceObject = this.modelManager.services[serviceName]
    if (!serviceObject) {
      console.error(
        `[ERROR] Available services:`,
        Object.keys(this.modelManager.services)
      )
      throw new Error(
        `Service "${serviceName}" not found in modelManager.services`
      )
    }

    return serviceObject
  }

  /**
   * Resolve a repository from the model manager
   */
  private resolveRepo(repoName: string): any {
    if (!this.modelManager) {
      throw new Error(
        `Cannot resolve repo "${repoName}" - modelManager not provided to ServerRemoteObject`
      )
    }

    const repoObject = this.modelManager.repos[repoName]
    if (!repoObject) {
      console.error(
        `[ERROR] Available repos:`,
        Object.keys(this.modelManager.repos)
      )
      throw new Error(`Repo "${repoName}" not found in modelManager.repos`)
    }

    return repoObject
  }

  /**
   * Resolves the full path for an endpoint
   * If path is specified, use it as-is
   * If path is not specified, default to kebab-case of service/repo name (or method name)
   */
  resolveEndpointPath(
    endpointConfig: ServerApiConfigEndpoint,
    method: string
  ): string {
    // If path is explicitly provided, use it as-is
    if (endpointConfig.path) {
      return endpointConfig.path
    }

    // If no path, check if endpoint has its own service/repo for default
    if (endpointConfig.service || endpointConfig.repo) {
      const remoteObjectName = endpointConfig.service || endpointConfig.repo
      return '/' + camelToKebab(remoteObjectName)
    }

    // Otherwise, default to method name
    return method
  }
}
