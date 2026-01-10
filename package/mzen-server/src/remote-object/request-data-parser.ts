import { Schema, ObjectPathAccessor } from 'mzen-om'
import { RequestInterface, ResponseInterface } from './interfaces'
import { ServerConfig } from '../server-config'

/**
 * Responsible for parsing and validating request data according to endpoint configuration
 * Follows Single Responsibility Principle
 */
export class RequestDataParser {
  private serverConfig: Partial<ServerConfig> & { [key: string]: any }

  constructor(serverConfig: Partial<ServerConfig> & { [key: string]: any }) {
    this.serverConfig = serverConfig
  }

  /**
   * Parse all request data fields according to configuration
   */
  parseRequestData(
    requestDataConfig: any,
    req: RequestInterface,
    res: ResponseInterface
  ): { [key: string]: any } {
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

  /**
   * Parse a single request data field
   */
  private parseOneRequestData(
    name: string,
    methodArgConfig: any,
    req: RequestInterface,
    res: ResponseInterface
  ): any {
    let value = undefined
    const src = methodArgConfig.src ? methodArgConfig.src : 'query'
    const srcPath = methodArgConfig.srcPath ? methodArgConfig.srcPath : name

    const container = {
      param: req.params ? req.params : {},
      query: req.query ? req.query : {},
      body: req.body ? req.body : {},
      request: req,
      response: res,
      config: this.serverConfig ? this.serverConfig : {},
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

  /**
   * Create validation spec from request data configuration
   */
  parseValidationSpec(requestDataConfig: any): any {
    const spec = {}

    const parseOne = (argConfig: any, key: string) => {
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

  /**
   * Validate request data against validation spec
   */
  async validateRequestData(
    requestData: any,
    validationSpec: any
  ): Promise<{ isValid: boolean; errors?: any }> {
    const schema = new Schema(validationSpec)
    const validateResult = await schema.validate(requestData)
    return {
      isValid: validateResult.isValid,
      errors: validateResult.errors,
    }
  }
}
