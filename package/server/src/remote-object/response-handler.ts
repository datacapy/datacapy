import { ResponseInterface } from './interfaces'
import { ServerApiConfigEndpointResponse } from '../api-config'

/**
 * Responsible for handling successful endpoint responses
 * Follows Single Responsibility Principle and Open/Closed Principle
 */
export class ResponseHandler {
  /**
   * Send a successful response based on configuration
   */
  sendSuccessResponse(
    res: ResponseInterface,
    response: any,
    responseSuccess: ServerApiConfigEndpointResponse
  ): void {
    const httpConfig = responseSuccess.http ? responseSuccess.http : {}
    const code = httpConfig.code ? httpConfig.code : 200
    const contentType = httpConfig.contentType ? httpConfig.contentType : 'json'

    if (contentType == 'json') {
      res.status(code).json(response)
    } else {
      if (contentType) res.type(contentType)
      res.status(code).send(response)
    }
  }
}
