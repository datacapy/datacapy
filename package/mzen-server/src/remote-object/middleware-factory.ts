import { AclInterface, RequestInterface, ResponseInterface } from './interfaces'
import {
  ServerApiConfigEndpoint,
  ServerApiConfigEndpointResponse,
} from '../api-config'
import {
  ServerErrorUnauthorized,
  serverErrorApiEndpointResponseConfig,
} from '../error'
import { RequestDataParser } from './request-data-parser'
import { ResponseHandler } from './response-handler'
import { ErrorHandler } from './error-handler'

/**
 * Responsible for creating middleware callbacks for endpoints
 * Follows Single Responsibility Principle and Dependency Inversion Principle
 */
export class MiddlewareFactory {
  private requestDataParser: RequestDataParser
  private responseHandler: ResponseHandler
  private errorHandler: ErrorHandler
  private remoteObjectContext: any

  constructor(
    requestDataParser: RequestDataParser,
    responseHandler: ResponseHandler,
    errorHandler: ErrorHandler,
    remoteObjectContext: any
  ) {
    this.requestDataParser = requestDataParser
    this.responseHandler = responseHandler
    this.errorHandler = errorHandler
    this.remoteObjectContext = remoteObjectContext
  }

  /**
   * Create middleware callback for an endpoint
   */
  createMiddlewareCallback(
    endpointName: string,
    endpointConfig: ServerApiConfigEndpoint,
    endpointObject: any,
    method: string,
    requestDataConfig: any,
    responseSuccess: ServerApiConfigEndpointResponse,
    responseErrorConfig: any
  ): (req: RequestInterface, res: ResponseInterface) => Promise<void> {
    return async (req: RequestInterface, res: ResponseInterface) => {
      try {
        // Parse and validate request data
        const requestData = this.requestDataParser.parseRequestData(
          requestDataConfig,
          req,
          res
        )
        const validationSpec =
          this.requestDataParser.parseValidationSpec(requestDataConfig)
        const validationResult =
          await this.requestDataParser.validateRequestData(
            requestData,
            validationSpec
          )

        if (!validationResult.isValid) {
          res.status(403).json({ validationErrors: validationResult.errors })
          return
        }

        // Verify method exists on object
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

        // Check ACL permissions
        const aclContext = { ...requestData }
        const remoteObjectWrapper = {
          ...this.remoteObjectContext,
          object: endpointObject,
        }
        await this.remoteObjectContext.acl.populateContext(
          req,
          aclContext,
          remoteObjectWrapper
        )
        const isPermitted = await this.remoteObjectContext.acl.isPermitted(
          endpointName,
          aclContext
        )

        if (isPermitted === false) {
          throw new ServerErrorUnauthorized()
        }

        // Append ACL context and conditions to request data
        requestData.aclContext = aclContext
        requestData.aclConditions =
          typeof isPermitted === 'object' ? isPermitted : {}

        // Call the endpoint method
        const response = await endpointObject[method].apply(endpointObject, [
          requestData,
        ])

        // Skip automatic response if endpoint handles it manually
        if (endpointConfig.skipResponse) {
          return
        }

        this.responseHandler.sendSuccessResponse(res, response, responseSuccess)
      } catch (err) {
        await this.errorHandler.handleEndpointError(
          err,
          res,
          req,
          endpointName,
          method,
          responseErrorConfig
        )
      }
    }
  }
}
