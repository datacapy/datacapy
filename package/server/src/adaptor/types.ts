// cspell:ignore linklocal uniquelocal
import type { IncomingMessage, Server as HttpServer } from 'http'
import type { Readable } from 'stream'

import type {
  RequestInterface,
  ResponseInterface,
} from '../remote-object/interfaces'
import type { ServerBodyParserConfig } from '../remote-object/body-parser-configurer'

/**
 * Framework-neutral HTTP contract. An adaptor implements `HttpAdaptor` for one
 * framework (Express, Hono); everything above it is written against these
 * types only. See docs/decisions/2026/2026-11-20_server-adaptor-*.md.
 */

export type HttpMethod =
  'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

/**
 * `app` handlers run before the datacapy router is mounted, `router` handlers
 * after it is created and before endpoints run. Order within a stage is
 * registration order.
 */
export type MiddlewareStage = 'app' | 'router'

export type NextFunction = (err?: unknown) => void

export interface HttpRequest extends RequestInterface {
  /** Path without the query string. */
  path: string
  /** Route params; a trailing wildcard is one string. */
  params: Record<string, string>
  query: Record<string, unknown>
  /** The raw Node request, for consumers that need a stream (multipart). */
  node: IncomingMessage
}

export interface StreamOptions {
  status?: number
  /** Content type, as `res.type()` accepts it. */
  type?: string
  headers?: Record<string, string>
  /** Sets `Content-Disposition: attachment; filename=...`. */
  filename?: string
}

export interface HttpResponse extends ResponseInterface {
  /** Sets the value exactly as given; no charset or other rewriting. */
  header(name: string, value: string): HttpResponse
  /** Adds a value without replacing earlier ones (needed for `Set-Cookie`). */
  append(name: string, value: string): HttpResponse
  /**
   * Pipes `readable` to the client. The adaptor handles back-pressure and
   * client abort, and the response counts as handled afterwards.
   */
  stream(readable: Readable, options?: StreamOptions): Promise<void>
  /** True once a body has been started or finished, by any means. */
  readonly handled: boolean
}

export type Handler = (
  req: HttpRequest,
  res: HttpResponse,
  next: NextFunction
) => void | Promise<void>

export type ErrorHandler = (
  err: unknown,
  req: HttpRequest,
  res: HttpResponse,
  next: NextFunction
) => void | Promise<void>

export interface StaticOptions {
  maxAge?: number | string
  index?: string | false
  /** Pass unmatched requests on instead of answering 404. Default true. */
  fallthrough?: boolean
}

/**
 * Proxies whose `X-Forwarded-For` is believed: the presets `loopback`,
 * `linklocal` and `uniquelocal`, or CIDR ranges and addresses. `[]` trusts
 * none, so `req.ip` is the socket address.
 */
export type TrustProxyConfig = string[]

export interface HttpAdaptor<TApp = unknown> {
  /** The framework instance, for code that must be adaptor-specific. */
  readonly native: TApp
  /** The Node server that carries the app (socket.io attaches here). */
  readonly server: HttpServer

  use(stage: MiddlewareStage, handler: Handler): void
  /** Inside a path-scoped handler `req.path` is relative to `path`. */
  use(stage: MiddlewareStage, path: string, handler: Handler): void
  /** Path syntax: `:name` segments and a trailing `/*name`. */
  route(
    stage: MiddlewareStage,
    method: HttpMethod,
    path: string,
    ...handlers: Handler[]
  ): void
  /** Mounts the router stage under `prefix`. Called once, after endpoints. */
  mountRouter(prefix: string): void
  setErrorHandler(handler: ErrorHandler): void

  /** Body parsing handlers for one endpoint's normalised config. */
  bodyParsers(config: ServerBodyParserConfig): Handler[]
  static(urlPath: string, directory: string, options?: StaticOptions): void
  trustProxy(config: TrustProxyConfig): void

  /** Optional: receives the server's logger when it is replaced. */
  setLogger?(logger: {
    error(message: unknown, ...optionalParams: unknown[]): void
    info?(message: unknown, ...optionalParams: unknown[]): void
  }): void

  listen(port: number): Promise<void>
  /** Stops accepting, destroys open connections, resolves when closed. */
  close(): Promise<void>
}
