import * as _Http from 'http'
import { ModelManager } from '@datacapy/om'

import { ServerConfig } from './server-config'
import { ServerApiConfig } from './api-config'
import ServerAclRoleAssessor from './acl/role-assessor'
import {
  ConfigurationManager,
  LifecycleManager,
  AclRegistry,
  ApiConfigRegistry,
  EndpointRegistrar,
} from './server/index'
import { ErrorTranslator } from './remote-object/interfaces'
import type {
  Handler,
  HttpAdaptor,
  HttpMethod,
  MiddlewareStage,
  StaticOptions,
  TrustProxyConfig,
} from './adaptor/types'
import { registerShutdownSignals } from './server/shutdown-signals'

/**
 * Server - Orchestrates server components following SOLID principles
 * Refactored to delegate responsibilities to specialized components
 */
export class Server {
  // Public properties (maintain backward compatibility)
  modelManager: ModelManager | any
  config: ServerConfig
  apiConfigs: Array<ServerApiConfig>
  server: _Http.Server | null
  adaptor: HttpAdaptor
  aclRoleAssessor: { [key: string]: any }
  logger: any
  initialisers: { [key: string]: any[] }
  shutdownHandlers: { [key: string]: any[] }
  initialised: boolean

  // Private components following DIP
  private configurationManager: ConfigurationManager
  private lifecycleManager: LifecycleManager
  private aclRegistry: AclRegistry
  private apiConfigRegistry: ApiConfigRegistry
  private endpointRegistrar: EndpointRegistrar

  constructor(options?: ServerConfig, modelManager?: ModelManager) {
    // Create components in dependency order
    this.configurationManager = new ConfigurationManager(options, modelManager)
    this.lifecycleManager = new LifecycleManager()
    this.adaptor = this.createAdaptor(this.configurationManager.getConfig())
    this.aclRegistry = new AclRegistry()
    this.apiConfigRegistry = new ApiConfigRegistry()

    // Initialize logger (default to console)
    this.logger = console

    // Create endpoint registrar (depends on other components)
    this.endpointRegistrar = new EndpointRegistrar(
      this.configurationManager,
      this.adaptor,
      this.aclRegistry,
      this.apiConfigRegistry,
      this.logger
    )

    // Expose component state for backward compatibility
    this.config = this.configurationManager.getConfig()
    this.modelManager = this.configurationManager.getModelManager()
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
      get: () => this.adaptor.server,
    })
  }

  private createAdaptor(config: ServerConfig): HttpAdaptor {
    const shutdown = () => this.shutdown()
    if (config.adaptor === 'hono') {
      // Loaded on demand so Express-only installs never need the optional peers
      const { HonoAdaptor } = this.loadAdaptor(
        'hono',
        () => require('./adaptor/hono') as typeof import('./adaptor/hono'),
        ['hono', '@hono/node-server']
      )
      return new HonoAdaptor(config, console, shutdown)
    }
    // Loaded on demand so Hono-only installs never need `express`
    const { ExpressAdaptor: Express } = this.loadAdaptor(
      'express',
      () => require('./adaptor/express') as typeof import('./adaptor/express'),
      ['express']
    )
    return new Express(config, console, shutdown)
  }

  /**
   * Runs `load`, turning a missing optional peer into an install hint. Any
   * other failure, including a missing module the adaptor does not list as a
   * peer, surfaces unchanged.
   */
  private loadAdaptor<T>(name: string, load: () => T, peers: string[]): T {
    try {
      return load()
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      const missing =
        err?.code === 'MODULE_NOT_FOUND' &&
        peers.some((peer) => this.namesModule(err.message, peer))
      if (!missing) throw error
      const hint = new Error(
        `adaptor '${name}' needs the optional peer '${peers[0]}'. Install it: pnpm add ${peers.join(' ')}`
      ) as Error & { cause?: unknown }
      hint.cause = error
      throw hint
    }
  }

  private namesModule(message: string, module: string): boolean {
    return message.includes(`'${module}'`) || message.includes(`"${module}"`)
  }

  use(stage: MiddlewareStage, handler: Handler): void
  use(stage: MiddlewareStage, path: string, handler: Handler): void
  use(stage: MiddlewareStage, a: string | Handler, b?: Handler): void {
    if (typeof a === 'string') {
      this.adaptor.use(stage, a, b as Handler)
    } else {
      this.adaptor.use(stage, a)
    }
  }

  route(
    stage: MiddlewareStage,
    method: HttpMethod,
    path: string,
    ...handlers: Handler[]
  ): void {
    this.adaptor.route(stage, method, path, ...handlers)
  }

  static(urlPath: string, directory: string, options?: StaticOptions): void {
    this.adaptor.static(urlPath, directory, options)
  }

  trustProxy(config: TrustProxyConfig): void {
    this.adaptor.trustProxy(config)
  }

  setLogger(logger): this {
    this.logger = logger
    this.configurationManager.setLogger(logger)
    this.adaptor.setLogger?.(logger)
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

      this.adaptor.mountRouter(this.config.path)
      await this.lifecycleManager.runInitialisers('04-router-mounted', this)

      this.adaptor.setErrorHandler((err, req, res, next) => {
        this.logger.error({ err, req, res })
        res.status(500).send('Something broke!')
        next()
      })

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
    await this.adaptor.listen(this.config.port)
    registerShutdownSignals(() => this.shutdown())
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

    return this.adaptor.close()
  }
}

export default Server
