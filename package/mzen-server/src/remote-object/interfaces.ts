/**
 * Interfaces for RemoteObject components following Dependency Inversion Principle
 */

export interface LoggerInterface {
  error(message: any, ...optionalParams: any[]): void
  warn?(message: any, ...optionalParams: any[]): void
  info?(message: any, ...optionalParams: any[]): void
  debug?(message: any, ...optionalParams: any[]): void
}

export interface ModelManagerInterface {
  services: { [key: string]: any }
  repos: { [key: string]: any }
}

export type ErrorTranslator = (
  err: any,
  req: RequestInterface
) => any | Promise<any>

export interface RequestInterface {
  url: string
  originalUrl: string
  method: string
  query?: any
  params?: any
  body?: any
  ip?: string
  headers?: any
  cookies?: any
  aclContext?: any
  aclConditions?: any
  get(header: string): string | undefined
}

export interface ResponseInterface {
  status(code: number): ResponseInterface
  json(data: any): ResponseInterface
  send(data: any): ResponseInterface
  type(contentType: string): ResponseInterface
  headersSent: boolean
  end(data?: any): void
}

export interface AclInterface {
  populateContext(
    req: RequestInterface,
    context: any,
    remoteObject: any
  ): Promise<boolean>
  isPermitted(endpointName: string, context: any): Promise<boolean | object>
}
