import { Schema, SchemaValidationResult } from 'mzen-om'
import {
  LoggerInterface,
  RequestInterface,
  ResponseInterface,
  ErrorTranslator,
} from './interfaces'
import { ServerApiConfigEndpointResponse } from '../api-config'

/**
 * Responsible for handling endpoint errors and error logging
 * Follows Single Responsibility Principle
 */
export class ErrorHandler {
  private logger: LoggerInterface
  private errorTranslator?: ErrorTranslator
  private exposeErrorDetails: boolean

  constructor(logger: LoggerInterface, exposeErrorDetails = false) {
    this.logger = logger
    this.exposeErrorDetails = exposeErrorDetails
  }

  /**
   * Set a new logger instance
   */
  setLogger(logger: LoggerInterface): void {
    this.logger = logger
  }

  /**
   * Whether an unhandled error's own message may be returned to the client.
   * Off by default - the host application opts in via the constructor, e.g.
   * only outside production, since server-side logging (unaffected by this
   * flag) already gets the full detail regardless.
   */
  setExposeErrorDetails(exposeErrorDetails: boolean): void {
    this.exposeErrorDetails = exposeErrorDetails
  }

  /**
   * Set an optional error translator, invoked on every thrown error before
   * it is matched/serialized. Framework-agnostic - no i18n dependency here,
   * just a typed callback the host application supplies.
   */
  setErrorTranslator(errorTranslator: ErrorTranslator): void {
    this.errorTranslator = errorTranslator
  }

  /**
   * Handle endpoint errors with appropriate HTTP responses and logging
   */
  async handleEndpointError(
    err: any,
    res: ResponseInterface,
    req: RequestInterface,
    endpointName: string,
    method: string,
    responseErrorConfig: any
  ): Promise<void> {
    try {
      if (this.errorTranslator) {
        err = await this.errorTranslator(err, req)
      }

      const error = err instanceof Error ? err : null
      let errorHandled = false
      let resolvedStatusCode: number | undefined

      if (Object.keys(responseErrorConfig).length) {
        for (const errorName in responseErrorConfig) {
          if (error && errorName !== error.constructor.name) {
            continue
          }

          const errorConfig = responseErrorConfig[
            errorName
          ] as ServerApiConfigEndpointResponse
          const schemaConfig = errorConfig.schema ? errorConfig.schema : null
          const httpConfig = errorConfig.http ? errorConfig.http : {}
          const code = httpConfig.code ? httpConfig.code : 400
          const contentType = httpConfig.contentType
            ? httpConfig.contentType
            : 'json'

          const validateResultError: SchemaValidationResult = schemaConfig
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
            resolvedStatusCode = code
          }
          break // Use first matching handler
        }
      }

      if (!errorHandled) {
        resolvedStatusCode = 500
      }

      this.logError(
        err,
        errorHandled,
        req,
        endpointName,
        method,
        resolvedStatusCode
      )

      if (!errorHandled) {
        this.sendUnhandledErrorResponse(res, err, endpointName, method)
      }
    } catch (outerErr) {
      this.handleFatalError(outerErr, err, res)
    }
  }

  /**
   * Log error details for debugging and monitoring
   */
  private logError(
    err: any,
    errorHandled: boolean,
    req: RequestInterface,
    endpointName: string,
    method: string,
    statusCode?: number
  ): void {
    const isInTest = typeof global.it === 'function'

    if (
      !isInTest &&
      // eslint-disable-next-line
      // @ts-ignore
      (err.ref == undefined || err.logged || !errorHandled)
    ) {
      const errorMessage =
        err?.message || err?.toString?.() || String(err) || 'Unknown error'
      const errorStack =
        err?.stack ||
        (err instanceof Error ? new Error().stack : null) ||
        'No stack trace available'
      const errorName = err?.name || err?.constructor?.name || 'Error'

      const errorDetails = [
        `Endpoint: ${endpointName}`,
        `Method: ${method}`,
        `Error: ${errorName} - ${errorMessage}`,
        `Stack: ${errorStack}`,
        !errorHandled
          ? 'WARNING: Error was not handled by endpoint error config'
          : null,
      ]
        .filter(Boolean)
        .join('\n')

      console.error(errorDetails)

      this.logger?.error({
        endpoint: endpointName,
        method: method,
        errorName: errorName,
        errorMessage: errorMessage,
        errorStack: errorStack,
        errorCode: err?.code,
        errorRef: err?.ref,
        handled: errorHandled,
        statusCode: statusCode,
        req: this.getMinimalRequestInfo(req),
      })
    }
  }

  /**
   * Send response for unhandled errors
   */
  private sendUnhandledErrorResponse(
    res: ResponseInterface,
    err: any,
    endpointName: string,
    method: string
  ): void {
    if (!res.headersSent) {
      const message = this.exposeErrorDetails
        ? err?.message || 'An unexpected error occurred'
        : 'An unexpected error occurred'
      res.status(500).json({
        error: 'InternalServerError',
        message,
        endpoint: endpointName,
        method: method,
      })
    }
  }

  /**
   * Handle fatal errors that occur during error handling itself
   */
  private handleFatalError(
    outerErr: any,
    originalErr: any,
    res: ResponseInterface
  ): void {
    console.error(
      '=== FATAL: Error in error handler ===\n' +
        `Outer error: ${outerErr}\n` +
        `Original error: ${originalErr}`
    )

    if (!res.headersSent) {
      try {
        res.status(500).json({
          error: 'FatalServerError',
          message: 'A fatal error occurred in the error handler',
        })
      } catch (finalErr) {
        res.status(500).end('Fatal server error')
      }
    }
  }

  /**
   * Extract minimal request information for logging
   */
  private getMinimalRequestInfo(req: RequestInterface): any {
    return {
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
  }
}
