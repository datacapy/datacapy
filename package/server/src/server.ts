import * as _Http from 'http'
import express from 'express'
import { ModelManager } from '@datacapy/om'

import { ServerConfig } from './server-config'
import { ServerApiConfig } from './api-config'
import ServerAclRoleAssessor from './acl/role-assessor'
import {
  ConfigurationManager,
  LifecycleManager,
  ExpressAppManager,
  HttpServerManager,
  AclRegistry,
  ApiConfigRegistry,
  EndpointRegistrar,
} from './server/index'
import { ErrorTranslator } from './remote-object/interfaces'

/**
 * Server - Orchestrates server components following SOLID principles
 * Refactored to delegate responsibilities to specialized components
 */
export class Server {
  // Public properties (maintain backward compatibility)
  modelManager: ModelManager | any
  config: ServerConfig
  apiConfigs: Array<ServerApiConfig>
  app: express.Application
  server: _Http.Server | null
  router: express.Router
  aclRoleAssessor: { [key: string]: any }
  logger: any
  initialisers: { [key: string]: any[] }
  shutdownHandlers: { [key: string]: any[] }
  initialised: boolean

  // Private components following DIP
  private configurationManager: ConfigurationManager
  private lifecycleManager: LifecycleManager
  private expressAppManager: ExpressAppManager
  private httpServerManager: HttpServerManager
  private aclRegistry: AclRegistry
  private apiConfigRegistry: ApiConfigRegistry
  private endpointRegistrar: EndpointRegistrar

  constructor(options?: ServerConfig, modelManager?: ModelManager) {
    // Create components in dependency order
    this.configurationManager = new ConfigurationManager(options, modelManager)
    this.lifecycleManager = new LifecycleManager()
    this.expressAppManager = new ExpressAppManager(
      this.configurationManager.getConfig(),
      console
    )
    this.aclRegistry = new AclRegistry()
    this.apiConfigRegistry = new ApiConfigRegistry()

    // Initialize logger (default to console)
    this.logger = console

    // Create endpoint registrar (depends on other components)
    this.endpointRegistrar = new EndpointRegistrar(
      this.configurationManager,
      this.expressAppManager,
      this.aclRegistry,
      this.apiConfigRegistry,
      this.logger
    )

    // Create HTTP server manager (depends on shutdown callback)
    this.httpServerManager = new HttpServerManager(
      this.expressAppManager.getApp(),
      this.configurationManager.getConfig(),
      this.logger,
      () => this.shutdown()
    )

    // Expose component state for backward compatibility
    this.config = this.configurationManager.getConfig()
    this.modelManager = this.configurationManager.getModelManager()
    this.app = this.expressAppManager.getApp()
    this.router = this.expressAppManager.getRouter()
    this.aclRoleAssessor = this.aclRegistry.getRoleAssessors()
    this.apiConfigs = this.apiConfigRegistry.getApiConfigs()
    this.server = null
    this.initialised = false

    // Expose lifecycle state via getters for backward compatibility
    Object.defineProperty(this, 'initialisers', {
      get: () => this.lifecycleManager.getInitialisers(),
    })
    Object.defineProperty(this, 'shutdownHandlers', {
      get: () => this.lifecycleManager.getShutdownHandlers(),
    })
    Object.defineProperty(this, 'server', {
      get: () => this.httpServerManager.getServer(),
    })
  }

  setLogger(logger): this {
    this.logger = logger
    this.configurationManager.setLogger(logger)
    this.expressAppManager['logger'] = logger
    this.httpServerManager['logger'] = logger
    this.endpointRegistrar['logger'] = logger
    return this
  }

  setErrorTranslator(errorTranslator: ErrorTranslator): this {
    this.endpointRegistrar['errorTranslator'] = errorTranslator
    return this
  }

  async init() {
    if (!this.initialised) {
      await this.lifecycleManager.runInitialisers(undefined, this)
      await this.lifecycleManager.runInitialisers('00-init', this)

      await this.modelManager.init()
      await this.lifecycleManager.runInitialisers('01-model-initialised', this)

      await this.lifecycleManager.runInitialisers('02-resources-loaded', this)

      this.endpointRegistrar.registerEndpoints()
      await this.lifecycleManager.runInitialisers(
        '03-endpoints-registered',
        this
      )

      this.expressAppManager.mountRouter(this.config.path)
      await this.lifecycleManager.runInitialisers('04-router-mounted', this)

      this.expressAppManager.setupErrorHandler(this.logger)

      await this.lifecycleManager.runInitialisers('99-final', this)

      this.initialised = true
    }
  }

  async runInitialisers(stage?: string) {
    await this.lifecycleManager.runInitialisers(stage, this)
  }

  addInitialiser(initialiser, stage?: string) {
    this.lifecycleManager.addInitialiser(initialiser, stage)
  }

  addInitialisers(initialisers, stage?: string) {
    this.lifecycleManager.addInitialisers(initialisers, stage)
  }

  addShutdownHandler(handler, stage?: string) {
    this.lifecycleManager.addShutdownHandler(handler, stage)
  }

  addShutdownHandlers(handlers, stage?: string) {
    this.lifecycleManager.addShutdownHandlers(handlers, stage)
  }

  async runShutdownHandlers(stage?: string) {
    await this.lifecycleManager.runShutdownHandlers(stage)
  }

  addRoleAssessor(roleAssessor: ServerAclRoleAssessor) {
    this.aclRegistry.addRoleAssessor(roleAssessor)
  }

  addRoleAssessors(roleAssessors: ServerAclRoleAssessor[]) {
    this.aclRegistry.addRoleAssessors(roleAssessors)
  }

  addApiConfig(config: ServerApiConfig) {
    this.apiConfigRegistry.addApiConfig(config)
  }

  addApiConfigs(configs: Array<ServerApiConfig>) {
    this.apiConfigRegistry.addApiConfigs(configs)
  }

  registerEndpoints() {
    this.endpointRegistrar.registerEndpoints()
  }

  registerEndpointsConfig(config: ServerApiConfig) {
    this.endpointRegistrar['registerEndpointsConfig'](config)
  }

  async start() {
    await this.httpServerManager.start()
  }

  async shutdown() {
    this.logger.info('Shutting down')

    await this.lifecycleManager.runShutdownHandlers('99-final')
    await this.lifecycleManager.runShutdownHandlers('04-router-mounted')
    await this.lifecycleManager.runShutdownHandlers('03-endpoints-registered')
    await this.lifecycleManager.runShutdownHandlers('02-resources-loaded')
    await this.lifecycleManager.runShutdownHandlers('01-model-initialised')

    await this.modelManager.shutdown()

    await this.lifecycleManager.runShutdownHandlers('00-init')
    await this.lifecycleManager.runShutdownHandlers()

    return this.httpServerManager.shutdown()
  }
}

export default Server
