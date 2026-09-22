import ServerAcl from './acl'
import { ServerConfig } from './server-config'
import { ServerError, serverErrorApiEndpointResponseConfig } from './error'
import {
  ServerApiConfigAcl,
  ServerApiConfigEndpoint,
  ServerApiConfigEndpointResponse,
} from './api-config'
import {
  LoggerInterface,
  ModelManagerInterface,
  AclInterface,
  ErrorTranslator,
} from './remote-object/interfaces'
import { RequestDataParser } from './remote-object/request-data-parser'
import {
  BodyParserConfigurer,
  ServerBodyParserConfig,
} from './remote-object/body-parser-configurer'
import { ResponseHandler } from './remote-object/response-handler'
import { ErrorHandler } from './remote-object/error-handler'
import { EndpointResolver } from './remote-object/endpoint-resolver'
import { MiddlewareFactory } from './remote-object/middleware-factory'

export interface ServerRemoteObjectConfig {
  path?: string
  acl?: ServerApiConfigAcl
  endpoints?: { [key: string]: ServerApiConfigEndpoint }
  server?: Partial<ServerConfig> & { [key: string]: any }
  remoteObjectName?: string
}

export interface ServerMiddlewareConfig {
  endpointName: string
  method: string
  verb: string
  path: string
  callback: Function
  priority: number
  bodyParserConfig?: ServerBodyParserConfig
}

/**
 * ServerRemoteObject - Orchestrates endpoint registration and middleware creation
 * Refactored to follow SOLID principles
 */
export class ServerRemoteObject {
  static error: { [key: string]: ServerError }

  config: ServerRemoteObjectConfig
  object: any
  acl: AclInterface
  private modelManager?: ModelManagerInterface

  // Dependency-injected components following DIP
  private requestDataParser: RequestDataParser
  private bodyParserConfigurer: BodyParserConfigurer
  private responseHandler: ResponseHandler
  private errorHandler: ErrorHandler
  private endpointResolver: EndpointResolver
  private middlewareFactory: MiddlewareFactory

  constructor(
    object: any,
    config?: ServerRemoteObjectConfig,
    modelManager?: ModelManagerInterface
  ) {
    // Normalize configuration
    this.config = config ? config : {}
    this.config.path = this.config.path ? this.config.path : ''
    this.config.endpoints = this.config.endpoints ? this.config.endpoints : {}
    this.config.acl = this.config.acl ? this.config.acl : {}
    this.config.acl.rules = this.config.acl.rules ? this.config.acl.rules : []
    this.config.server = this.config.server ? this.config.server : { path: '' }

    this.object = object
    this.modelManager = modelManager

    // Initialize ACL
    this.acl = new ServerAcl({
      rules: this.config.acl.rules,
      endpoints: this.config.endpoints,
    })

    // Initialize components following DIP
    this.requestDataParser = new RequestDataParser(this.config.server)
    this.bodyParserConfigurer = new BodyParserConfigurer()
    this.responseHandler = new ResponseHandler()
    this.errorHandler = new ErrorHandler(
      console as LoggerInterface,
      !!this.config.server?.exposeErrorDetails
    )
    this.endpointResolver = new EndpointResolver(this.object, this.modelManager)
    this.middlewareFactory = new MiddlewareFactory(
      this.requestDataParser,
      this.responseHandler,
      this.errorHandler,
      this // Pass full remote object context for ACL
    )
  }

  setLogger(logger: LoggerInterface): this {
    this.errorHandler.setLogger(logger)
    return this
  }

  setErrorTranslator(errorTranslator?: ErrorTranslator): this {
    if (errorTranslator) {
      this.errorHandler.setErrorTranslator(errorTranslator)
    }
    return this
  }

  initRouter(router: any): void {
    const middlewareConfigs = this.getMiddlewareConfig()
    middlewareConfigs.forEach((middlewareConfig) => {
      const bodyParserMiddleware = this.bodyParserConfigurer.getMiddleware(
        middlewareConfig.bodyParserConfig
      )
      router[middlewareConfig.verb].apply(router, [
        middlewareConfig.path,
        ...bodyParserMiddleware,
        middlewareConfig.callback,
      ])
    })
  }

  setAcl(acl: AclInterface): void {
    this.acl = acl
  }

  getMiddlewareConfig(): ServerMiddlewareConfig[] {
    const middleware: ServerMiddlewareConfig[] = []

    for (const endpointName in this.config.endpoints) {
      const endpointConfig = this.config.endpoints[endpointName]
      const verbs = endpointConfig.verbs ? endpointConfig.verbs : ['get']
      const method = endpointConfig.method ? endpointConfig.method : ''

      // Resolve endpoint-specific object and path using EndpointResolver
      const endpointObject =
        this.endpointResolver.resolveEndpointObject(endpointConfig)
      const path = this.endpointResolver.resolveEndpointPath(
        endpointConfig,
        method
      )

      const bodyParserConfigInit = endpointConfig.bodyParser
        ? endpointConfig.bodyParser
        : {}
      const bodyParserConfig =
        this.bodyParserConfigurer.normalizeConfig(bodyParserConfigInit)
      const requestDataConfig = endpointConfig.data ? endpointConfig.data : {}
      const priority =
        endpointConfig.priority != undefined ? endpointConfig.priority : 0

      const response = endpointConfig.response ? endpointConfig.response : {}
      const responseSuccess = response.success ? response.success : {}
      const responseErrorConfig = response.error
        ? {
            ...response.error,
            ...serverErrorApiEndpointResponseConfig,
          }
        : serverErrorApiEndpointResponseConfig

      verbs.forEach((verb) => {
        const middlewareCallback =
          this.middlewareFactory.createMiddlewareCallback(
            endpointName,
            endpointConfig,
            endpointObject,
            method,
            requestDataConfig,
            responseSuccess,
            responseErrorConfig
          )

        const fullPath = this.config.path + path

        middleware.push({
          endpointName: endpointName,
          method: method,
          verb: verb,
          path: fullPath,
          callback: middlewareCallback,
          priority: priority,
          bodyParserConfig,
        })
      })
    }

    return middleware.sort((a, b) => b.priority - a.priority)
  }
}

// Re-export commonly used types for backward compatibility
export { ServerBodyParserConfig } from './remote-object/body-parser-configurer'
export {
  LoggerInterface,
  ModelManagerInterface,
  AclInterface,
  RequestInterface,
  ResponseInterface,
} from './remote-object/interfaces'

export default ServerRemoteObject
