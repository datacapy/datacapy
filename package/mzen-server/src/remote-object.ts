import ServerAcl from './acl'
import { ServerConfig } from './server-config'
import { Schema, SchemaValidationResult, ObjectPathAccessor } from 'mzen-om'
import {
  ServerError,
  ServerErrorUnauthorized,
  serverErrorApiEndpointResponseConfig,
} from './error'
import {
  ServerApiConfigAcl,
  ServerApiConfigEndpoint,
  ServerApiConfigEndpointResponse,
} from './api-config'
import * as bodyParser from 'body-parser'

export interface ServerRemoteObjectConfig {
  path?: string
  acl?: ServerApiConfigAcl
  endpoints?: { [key: string]: ServerApiConfigEndpoint }
  server?: ServerConfig
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

export interface ServerBodyParserConfig {
  json?: {
    enable?: boolean
    limit?: string | boolean
    type?: string
  }
  urlencoded?: {
    enable?: boolean
    limit?: string | boolean
    extended?: boolean
    type?: string
  }
  text?: {
    enable?: boolean
    limit?: string | boolean
    type?: string
  }
  raw?: {
    enable?: boolean
    limit?: string | boolean
    type?: string
  }
}

export class ServerRemoteObject {
  static error: { [key: string]: ServerError }

  config: ServerRemoteObjectConfig
  object: any
  acl: ServerAcl
  logger: any
  modelManager: any

  constructor(object, config?, modelManager?) {
    this.config = config ? config : {}
    this.config.path = this.config.path ? this.config.path : ''
    this.config.endpoints = this.config.endpoints ? this.config.endpoints : {}
    this.config.acl = this.config.acl ? this.config.acl : {}
    this.config.acl.rules = this.config.acl.rules ? this.config.acl.rules : []
    this.config.server = this.config.server ? this.config.server : { path: '' }

    this.object = object
    this.modelManager = modelManager
    this.acl = new ServerAcl({
      rules: this.config.acl.rules,
      endpoints: this.config.endpoints,
    })
    this.setLogger(console)
  }

  setLogger(logger) {
    this.logger = logger
    return this
  }

  getBodyParserMiddleware(bodyParserConfig): any[] {
    const { json, urlencoded, text, raw } = bodyParserConfig
    const middlware: any[] = []
    if (json && json.enable) {
      middlware.push(bodyParser.json(json))
    }
    if (urlencoded && urlencoded.enable) {
      middlware.push(bodyParser.urlencoded(urlencoded))
    }
    if (text && text.enable) {
      middlware.push(bodyParser.text(text))
    }
    if (raw && raw.enable) {
      middlware.push(bodyParser.text(raw))
    }
    return middlware
  }

  initRouter(router) {
    const middlewareConfigs = this.getMiddlewareConfig()
    middlewareConfigs.forEach((middlewareConfig) => {
      const bodyParserMiddleware = this.getBodyParserMiddleware(
        middlewareConfig.bodyParserConfig
      )
      router[middlewareConfig.verb].apply(router, [
        middlewareConfig.path,
        ...bodyParserMiddleware,
        middlewareConfig.callback,
      ])
    })
  }

  setAcl(acl) {
    this.acl = acl
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
      if (!this.modelManager) {
        throw new Error(
          `Cannot resolve service "${endpointConfig.service}" - modelManager not provided to ServerRemoteObject`
        )
      }
      const serviceObject = this.modelManager.services[endpointConfig.service]
      if (!serviceObject) {
        console.error(
          `[ERROR] Available services:`,
          Object.keys(this.modelManager.services)
        )
        throw new Error(
          `Service "${endpointConfig.service}" not found in modelManager.services`
        )
      }
      return serviceObject
    }

    // Priority 3: Repo lookup
    if (endpointConfig.repo) {
      if (!this.modelManager) {
        throw new Error(
          `Cannot resolve repo "${endpointConfig.repo}" - modelManager not provided to ServerRemoteObject`
        )
      }
      const repoObject = this.modelManager.repos[endpointConfig.repo]
      if (!repoObject) {
        console.error(
          `[ERROR] Available repos:`,
          Object.keys(this.modelManager.repos)
        )
        throw new Error(
          `Repo "${endpointConfig.repo}" not found in modelManager.repos`
        )
      }
      return repoObject
    }

    // Fallback: Use config-level object
    return this.object
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

  getMiddlewareConfig(): ServerMiddlewareConfig[] {
    const middleware: ServerMiddlewareConfig[] = []

    for (const endpointName in this.config.endpoints) {
      const endpointConfig = this.config.endpoints[endpointName]
      const verbs = endpointConfig.verbs ? endpointConfig.verbs : ['get']
      const method = endpointConfig.method ? endpointConfig.method : ''

      // Resolve endpoint-specific object and path
      const endpointObject = this.resolveEndpointObject(endpointConfig)
      const path = this.resolveEndpointPath(endpointConfig, method)

      const bodyParserConfigInit = endpointConfig.bodyParser
        ? endpointConfig.bodyParser
        : {}
      const bodyParserConfig =
        this.bodyParserConfigNormalise(bodyParserConfigInit)
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
        const middlewareCallback = async (req, res) => {
          try {
            const requestData = this.parseRequestData(
              requestDataConfig,
              req,
              res
            )
            const validationSpec = this.parseValidationSpec(requestDataConfig)
            const aclContext = { ...requestData }
            const argValidateSchema = new Schema(validationSpec)
            const validateResult = await argValidateSchema.validate(requestData)

            if (!validateResult.isValid) {
              res.status(403).json({ validationErrors: validateResult.errors })
              return
            }

            if (endpointObject[method] === undefined) {
              throw new Error(
                'Method "' +
                  method +
                  '" is not defined in ' +
                  (endpointConfig.object
                    ? 'endpoint object'
                    : endpointConfig.service
                      ? `service "${endpointConfig.service}"`
                      : endpointConfig.repo
                        ? `repo "${endpointConfig.repo}"`
                        : 'config-level object') +
                  ' for endpoint "' +
                  endpointName +
                  '"'
              )
            }

            // Pass endpoint-specific remote object for ACL context
            const remoteObjectWrapper = { ...this, object: endpointObject }
            await this.acl.populateContext(req, aclContext, remoteObjectWrapper)
            const isPermitted = await this.acl.isPermitted(
              endpointName,
              aclContext
            )
            if (isPermitted === false) {
              throw new ServerErrorUnauthorized()
            }

            // Append the aclContext and aclConditions to the requestData
            // - these are always appended in this order and are not configurable
            requestData.aclContext = aclContext
            requestData.aclConditions =
              typeof isPermitted === 'object' ? isPermitted : {}

            // Call method on endpoint-specific object
            const response = await endpointObject[method].apply(
              endpointObject,
              [requestData]
            )

            // Skip automatic response if endpoint handles it manually
            if (endpointConfig.skipResponse) {
              return
            }

            const httpConfig = responseSuccess.http ? responseSuccess.http : {}
            const code = httpConfig.code ? httpConfig.code : 200
            const contentType = httpConfig.contentType
              ? httpConfig.contentType
              : 'json'
            if (contentType == 'json') {
              res.status(code).json(response)
            } else {
              if (contentType) res.type(contentType)
              res.status(code).send(response)
            }
          } catch (err) {
            try {
              const error = err instanceof Error ? err : null
              let errorHandled = false
              if (Object.keys(responseErrorConfig).length) {
                for (const errorName in responseErrorConfig) {
                  if (error && errorName !== error.constructor.name) {
                    continue
                  }

                  const errorConfig = responseErrorConfig[
                    errorName
                  ] as ServerApiConfigEndpointResponse
                  const schemaConfig = errorConfig.schema
                    ? errorConfig.schema
                    : null
                  const httpConfig = errorConfig.http ? errorConfig.http : {}
                  const code = httpConfig.code ? httpConfig.code : 400
                  const contentType = httpConfig.contentType
                    ? httpConfig.contentType
                    : 'json'

                  const validateResultError: SchemaValidationResult =
                    schemaConfig
                      ? await new Schema(schemaConfig).validate(err)
                      : { isValid: true }
                  if (validateResultError.isValid) {
                    if (contentType == 'json') {
                      res.status(code).json(error)
                    } else {
                      if (contentType) res.type(contentType)
                      res.status(code).send(error?.message)
                    }
                    errorHandled = true
                  }
                  break // We use the first handle that matches and ignore any others
                }
              }
              const isInTest = typeof global.it === 'function' // dont log anything when in automated test enviroment
              if (
                !isInTest &&
                // eslint-disable-next-line
                // @ts-ignore
                (err.ref == undefined || err.logged || !errorHandled)
              ) {
                // Errors which have a ref defined are expected to be handled by the client so we dont need to log them
                // Errors which do not have a ref are not expected by the client and must be logged
                // Errors which have a ref may be forced to log if the logged flag value is set to true
                // Unhandled errors are not expected by either the server or the client and must be logged

                // Extract error details with fallbacks to ensure meaningful logs
                const errorMessage =
                  err?.message ||
                  err?.toString?.() ||
                  String(err) ||
                  'Unknown error'

                const errorStack =
                  err?.stack ||
                  (err instanceof Error ? new Error().stack : null) ||
                  'No stack trace available'

                const errorName = err?.name || err?.constructor?.name || 'Error'

                // Log to console for immediate visibility
                console.error('Endpoint:', endpointName)
                console.error('Method:', method)
                console.error('Error:', errorName, '-', errorMessage)
                console.error('Stack:', errorStack)
                if (!errorHandled) {
                  console.error(
                    'WARNING: Error was not handled by endpoint error config'
                  )
                }

                // Also log via logger for structured logging
                this.logger?.error({
                  endpoint: endpointName,
                  method: method,
                  errorName: errorName,
                  errorMessage: errorMessage,
                  errorStack: errorStack,
                  errorCode: err?.code,
                  errorRef: err?.ref,
                  handled: errorHandled,
                  req: this.requestMin(req),
                })
              }
              if (!errorHandled) {
                // Always send a response for unhandled errors
                if (!res.headersSent) {
                  res.status(500).json({
                    error: 'InternalServerError',
                    message: err?.message || 'An unexpected error occurred',
                    endpoint: endpointName,
                    method: method,
                  })
                }
              }
            } catch (outerErr) {
              // Catch-all for errors in error handling itself
              console.error('=== FATAL: Error in error handler ===')
              console.error('Outer error:', outerErr)
              console.error('Original error:', err)

              if (!res.headersSent) {
                try {
                  res.status(500).json({
                    error: 'FatalServerError',
                    message: 'A fatal error occurred in the error handler',
                  })
                } catch (finalErr) {
                  // Last resort - just end the response
                  res.status(500).end('Fatal server error')
                }
              }
            }
          }
        }

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

  parseValidationSpec(requestDataConfig) {
    const spec = {}

    const parseOne = (argConfig, key?) => {
      const type = argConfig.type ? argConfig.type : null

      spec[key] = {}
      spec[key].$type = type
      spec[key].$validate = {}
      spec[key].$filter = {}
      if (argConfig.required !== undefined)
        spec[key].$validate.required = argConfig.required
      if (argConfig.notNull !== undefined)
        spec[key].$validate.notNull = argConfig.notNull
      if (argConfig.notEmpty !== undefined)
        spec[key].$validate.notEmpty = argConfig.notEmpty
      if (argConfig.defaultValue !== undefined)
        spec[key].$filter.defaultValue = argConfig.defaultValue
    }

    for (const key in requestDataConfig) {
      parseOne(requestDataConfig[key], key)
    }

    return spec
  }

  parseRequestData(requestDataConfig, req, res): { [key: string]: any } {
    const values = {}
    for (const name in requestDataConfig) {
      values[name] = this.parseOneRequestData(
        name,
        requestDataConfig[name],
        req,
        res
      )
    }
    return values
  }

  parseOneRequestData(name, methodArgConfig, req, res) {
    let value = undefined
    const src = methodArgConfig.src ? methodArgConfig.src : 'query'
    const srcPath = methodArgConfig.srcPath ? methodArgConfig.srcPath : name

    const container = {
      param: req.params ? req.params : {},
      query: req.query ? req.query : {},
      body: req.body ? req.body : {},
      request: req,
      response: res,
      config: this.config.server ? this.config.server : {},
      aclContext: req.aclContext ? req.aclContext : {},
      aclConditions: req.aclConditions ? req.aclConditions : {},
    }

    switch (src) {
      case 'header':
        value = container.request.get(srcPath)
        break
      case 'container':
        value = ObjectPathAccessor.getPath(srcPath, container)
        break
      default:
        value = ObjectPathAccessor.getPath(srcPath, container[src])
        break
    }

    return value
  }

  bodyParserConfigNormalise(
    config: ServerBodyParserConfig
  ): ServerBodyParserConfig {
    config = config ? config : {}
    const { json, urlencoded, text, raw } = config
    const jsonDefault = { enable: true, limit: '100kb' }
    const urlencodedDefault = { enable: false, limit: '100kb', extended: true }
    const textDefault = { enable: false, limit: '100kb' }
    const rawDefault = { enable: false, limit: '100kb' }
    return {
      json: json
        ? {
            enable:
              json.enable != undefined ? !!json.enable : jsonDefault.enable,
            limit: json.limit != undefined ? json.limit : jsonDefault.limit,
            type: json.type != undefined ? json.type : undefined,
          }
        : jsonDefault,
      urlencoded: urlencoded
        ? {
            enable:
              urlencoded.enable != undefined
                ? !!urlencoded.enable
                : urlencodedDefault.enable,
            limit:
              urlencoded.limit != undefined
                ? urlencoded.limit
                : urlencodedDefault.limit,
            extended:
              urlencoded.extended != undefined
                ? urlencoded.extended
                : urlencodedDefault.extended,
            type: urlencoded.type != undefined ? urlencoded.type : undefined,
          }
        : urlencodedDefault,
      text: text
        ? {
            enable:
              text.enable != undefined ? !!text.enable : textDefault.enable,
            limit: text.limit != undefined ? text.limit : textDefault.limit,
            type: text.type != undefined ? text.type : undefined,
          }
        : textDefault,
      raw: raw
        ? {
            enable: raw.enable != undefined ? !!raw.enable : rawDefault.enable,
            limit: raw.limit != undefined ? raw.limit : rawDefault.limit,
            type: raw.type != undefined ? raw.type : undefined,
          }
        : textDefault,
    }
  }

  requestMin(req) {
    const result = {
      url: req.url,
      originalUrl: req.originalUrl,
      method: req.method,
      query: req.query,
      params: req.params,
      ip: req.ip,
      headers: req.headers,
      cookies: req.cookies,
      body: req.body,
    }
    return result
  }
}

/**
 * Converts camelCase to kebab-case
 * Example: 'surveyParticipant' -> 'survey-participant'
 */
function camelToKebab(input: string): string {
  return input ? input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() : ''
}

export default ServerRemoteObject
