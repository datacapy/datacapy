/**
 * Interfaces for Server components following Dependency Inversion Principle
 */

import { ServerConfig } from '../server-config'
import { ServerApiConfig } from '../api-config'
import ServerAclRoleAssessor from '../acl/role-assessor'

// Re-export logger interface from remote-object for consistency
export interface LoggerInterface {
  error(message: any, ...optionalParams: any[]): void
  warn?(message: any, ...optionalParams: any[]): void
  info?(message: any, ...optionalParams: any[]): void
  debug?(message: any, ...optionalParams: any[]): void
}

// Model Manager interface
export interface ModelManagerInterface {
  services: { [key: string]: any }
  repos: { [key: string]: any }
  init(): Promise<any>
  shutdown(): Promise<any>
  setLogger(logger: any): void
}

// Configuration Manager interface
export interface ConfigurationManagerInterface {
  getConfig(): ServerConfig
  getModelManager(): ModelManagerInterface
  setLogger(logger: LoggerInterface): void
}

// Lifecycle Manager interface
export interface LifecycleManagerInterface {
  addInitialiser(initialiser: Function, stage?: string): void
  addInitialisers(initialisers: Function[], stage?: string): void
  runInitialisers(stage: string | undefined, context: any): Promise<void>
  addShutdownHandler(handler: Function, stage?: string): void
  addShutdownHandlers(handlers: Function[], stage?: string): void
  runShutdownHandlers(stage?: string): Promise<void>
}

// Express App Manager interface
export interface ExpressAppManagerInterface {
  getApp(): any // express.Application
  getRouter(): any // express.Router
  mountRouter(path: string): void
  setupErrorHandler(logger: LoggerInterface): void
}

// HTTP Server Manager interface
export interface HttpServerManagerInterface {
  start(): Promise<void>
  shutdown(): Promise<any>
  getServer(): any // _Http.Server | null
}

// ACL Registry interface
export interface AclRegistryInterface {
  addRoleAssessor(roleAssessor: ServerAclRoleAssessor): void
  addRoleAssessors(roleAssessors: ServerAclRoleAssessor[]): void
  getRoleAssessors(): { [key: string]: any }
}

// API Config Registry interface
export interface ApiConfigRegistryInterface {
  addApiConfig(config: ServerApiConfig): void
  addApiConfigs(configs: ServerApiConfig[]): void
  getApiConfigs(): ServerApiConfig[]
}

// Endpoint Registrar interface
export interface EndpointRegistrarInterface {
  registerEndpoints(): void
}

// Server interface (for dependency injection into initialisers)
export interface ServerInterface {
  config: ServerConfig
  modelManager: ModelManagerInterface
  logger: LoggerInterface
  app: any
  router: any
  aclRoleAssessor: { [key: string]: any }
}
