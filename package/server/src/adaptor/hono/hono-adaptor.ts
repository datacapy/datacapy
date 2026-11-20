// cspell:ignore proxyaddr
import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { getRequestListener } from '@hono/node-server'
import type { HttpBindings } from '@hono/node-server'
import type { IncomingMessage, Server as HttpServer } from 'http'
import proxyaddr from 'proxy-addr'

import { HttpServerManager } from '../../server/http-server-manager'
import type { LoggerInterface } from '../../server/interfaces'
import type { ServerConfig } from '../../server-config'
import type { ServerBodyParserConfig } from '../../remote-object/body-parser-configurer'
import type {
  ErrorHandler,
  Handler,
  HttpAdaptor,
  HttpMethod,
  MiddlewareStage,
  StaticOptions,
  TrustProxyConfig,
} from '../types'
import { createBodyParsers } from './body-parsers'
import { HonoRequest } from './hono-request'
import { HonoResponse } from './hono-response'
import { toHonoPath } from './route-path'
import { createStaticHandler } from './static-files'

interface RequestState {
  req: HonoRequest
  res: HonoResponse
}

interface HonoEnv {
  Bindings: HttpBindings
  Variables: { neutral: RequestState }
}

type Outcome =
  | { kind: 'next'; error?: unknown }
  | { kind: 'error'; error: unknown }
  | { kind: 'response'; response: Response }

type TrustFunction = (address: string, hop: number) => boolean

const trustNone: TrustFunction = () => false

export class HonoAdaptor implements HttpAdaptor<Hono<HonoEnv>> {
  private readonly app = new Hono<HonoEnv>({ strict: false })
  private readonly router = new Hono<HonoEnv>({ strict: false })
  private readonly serverManager: HttpServerManager
  private mountPrefix: string | null = null
  private errorHandler: ErrorHandler | null = null
  private trust: TrustFunction = trustNone

  constructor(
    config: ServerConfig,
    logger: LoggerInterface,
    onShutdown: () => Promise<void>
  ) {
    this.serverManager = new HttpServerManager(
      getRequestListener(this.app.fetch),
      config,
      logger,
      onShutdown
    )
    this.app.use('*', this.attach)
    this.app.onError((error, c) => this.respondToError(error, c))
  }

  get native(): Hono<HonoEnv> {
    return this.app
  }

  get server(): HttpServer {
    return this.serverManager.getServer()
  }

  setLogger(logger: LoggerInterface): void {
    this.serverManager.setLogger(logger)
  }

  use(stage: MiddlewareStage, handler: Handler): void
  use(stage: MiddlewareStage, path: string, handler: Handler): void
  use(stage: MiddlewareStage, a: string | Handler, b?: Handler): void {
    const target = this.target(stage)
    if (typeof a === 'string') {
      const scope = a.replace(/\/+$/, '')
      target.use(
        `${toHonoPath(scope)}/*`,
        this.wrap(b as Handler, stage, scope)
      )
    } else {
      target.use('*', this.wrap(a, stage))
    }
  }

  route(
    stage: MiddlewareStage,
    method: HttpMethod,
    path: string,
    ...handlers: Handler[]
  ): void {
    const target = this.target(stage)
    for (const handler of handlers) {
      target.on(
        method.toUpperCase(),
        toHonoPath(path),
        this.wrap(handler, stage)
      )
    }
  }

  mountRouter(prefix: string): void {
    this.mountPrefix = prefix === '/' ? '' : prefix
    this.app.route(prefix || '/', this.router)
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.errorHandler = handler
  }

  bodyParsers(config: ServerBodyParserConfig): Handler[] {
    return createBodyParsers(config)
  }

  static(urlPath: string, directory: string, options?: StaticOptions): void {
    const scope = urlPath.replace(/\/+$/, '')
    this.app.use(
      `${scope}/*`,
      this.wrap(createStaticHandler(directory, options), 'app', scope)
    )
  }

  trustProxy(config: TrustProxyConfig): void {
    this.trust = config.length ? proxyaddr.compile(config) : trustNone
  }

  listen(port: number): Promise<void> {
    const server = this.server
    return new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.once('listening', () => {
        server.off('error', reject)
        resolve()
      })
      void this.serverManager.listen(port)
    })
  }

  close(): Promise<void> {
    return this.serverManager.shutdown()
  }

  private target(stage: MiddlewareStage): Hono<HonoEnv> {
    if (stage === 'app') return this.app
    if (this.mountPrefix !== null) {
      throw new Error(
        'The router stage is already mounted; register router handlers before mountRouter'
      )
    }
    return this.router
  }

  /** Creates the request and response objects every handler of one request shares. */
  private readonly attach: MiddlewareHandler<HonoEnv> = async (c, next) => {
    const state: RequestState = {
      req: new HonoRequest(c.req.raw, c.env.incoming, (node) =>
        this.clientIp(node)
      ),
      res: new HonoResponse(),
    }
    c.set('neutral', state)
    await next()
    if (!state.res.headersSent) this.carryHeaders(state.res, c)
  }

  private clientIp(node: IncomingMessage): string | undefined {
    return proxyaddr(node, this.trust)
  }

  /** Headers handlers set on a request that Hono itself answers (a 404, say). */
  private carryHeaders(res: HonoResponse, c: Context<HonoEnv>): void {
    try {
      for (const [name, value] of res.headers) {
        if (name === 'set-cookie') c.res.headers.append(name, value)
        else if (!c.res.headers.has(name)) c.res.headers.set(name, value)
      }
    } catch {
      // an immutable response keeps the headers it has
    }
  }

  private wrap(
    handler: Handler,
    stage: MiddlewareStage,
    scope = ''
  ): MiddlewareHandler<HonoEnv> {
    return async (c, next) => {
      const { req, res } = c.get('neutral')
      const base = (stage === 'router' ? (this.mountPrefix ?? '') : '') + scope
      req.enter(base, { ...c.req.param() })

      const outcome = await this.run(handler, req, res)
      if (outcome.kind === 'response') return outcome.response
      if (outcome.kind === 'error') throw outcome.error
      if (outcome.error !== undefined) throw outcome.error
      await next()
    }
  }

  /** Waits until the handler answers, calls next, or fails; handlers may do so from callbacks. */
  private run(
    handler: Handler,
    req: HonoRequest,
    res: HonoResponse,
    error?: unknown
  ): Promise<Outcome> {
    return new Promise<Outcome>((resolve) => {
      void res.committed.then((response) =>
        resolve({ kind: 'response', response })
      )
      const next = (err?: unknown) => resolve({ kind: 'next', error: err })
      const fail = (err: unknown) => resolve({ kind: 'error', error: err })
      try {
        const result = (handler as (...args: unknown[]) => unknown)(
          req,
          res,
          next
        )
        if (result instanceof Promise) result.catch(fail)
      } catch (err) {
        fail(err)
      }
    })
  }

  private async respondToError(
    error: unknown,
    c: Context<HonoEnv>
  ): Promise<Response> {
    const { req, res } = c.get('neutral')
    if (res.headersSent) return c.res

    if (this.errorHandler) {
      const handler = this.errorHandler
      const outcome = await new Promise<Outcome>((resolve) => {
        void res.committed.then((response) =>
          resolve({ kind: 'response', response })
        )
        const next = (err?: unknown) =>
          resolve({ kind: 'next', error: err ?? error })
        const fail = (err: unknown) => resolve({ kind: 'error', error: err })
        try {
          const result = handler(error, req, res, next)
          if (result instanceof Promise) result.catch(fail)
        } catch (err) {
          fail(err)
        }
      })
      if (outcome.kind === 'response') return outcome.response
      error =
        outcome.kind === 'error' ? outcome.error : (outcome.error ?? error)
    }
    return this.defaultErrorResponse(error, res)
  }

  private defaultErrorResponse(
    error: unknown,
    res: HonoResponse
  ): Promise<Response> {
    const status = this.statusOf(error)
    const message =
      status < 500 && error instanceof Error
        ? error.message
        : 'Internal Server Error'
    res.type('text/plain').status(status).send(message)
    return res.committed
  }

  private statusOf(error: unknown): number {
    if (typeof error === 'object' && error !== null) {
      const { status, statusCode } = error as {
        status?: unknown
        statusCode?: unknown
      }
      const code = typeof status === 'number' ? status : statusCode
      if (typeof code === 'number' && code >= 400 && code <= 599) return code
    }
    return 500
  }
}
