import express from 'express'
import type { IncomingMessage, Server as HttpServer } from 'http'
import type { Readable } from 'stream'
import { pipeline } from 'stream/promises'

import { ExpressAppManager } from '../../server/express-app-manager'
import { HttpServerManager } from '../../server/http-server-manager'
import type { LoggerInterface } from '../../server/interfaces'
import type { ServerConfig } from '../../server-config'
import { BodyParserConfigurer } from '../../remote-object/body-parser-configurer'
import type { ServerBodyParserConfig } from '../../remote-object/body-parser-configurer'
import type {
  ErrorHandler,
  Handler,
  HttpAdaptor,
  HttpMethod,
  HttpResponse,
  MiddlewareStage,
  StaticOptions,
  StreamOptions,
  TrustProxyConfig,
} from '../types'

export class ExpressAdaptor implements HttpAdaptor<express.Application> {
  private readonly appManager: ExpressAppManager
  private readonly serverManager: HttpServerManager
  private readonly bodyParserConfigurer = new BodyParserConfigurer()

  constructor(
    config: ServerConfig,
    logger: LoggerInterface,
    onShutdown: () => Promise<void>
  ) {
    this.appManager = new ExpressAppManager(config, logger)
    this.serverManager = new HttpServerManager(
      this.appManager.getApp(),
      config,
      logger,
      onShutdown
    )
    this.appManager.getApp().use(this.augment)
  }

  get native(): express.Application {
    return this.appManager.getApp()
  }

  get server(): HttpServer {
    return this.serverManager.getServer()
  }

  /** The router stage as an Express router, for code that predates the adaptor. */
  getRouter(): express.Router {
    return this.appManager.getRouter()
  }

  setLogger(logger: LoggerInterface): void {
    this.appManager.setLogger(logger)
    this.serverManager.setLogger(logger)
  }

  use(stage: MiddlewareStage, handler: Handler): void
  use(stage: MiddlewareStage, path: string, handler: Handler): void
  use(stage: MiddlewareStage, a: string | Handler, b?: Handler): void {
    const target = this.target(stage)
    if (typeof a === 'string') {
      target.use(a, this.toExpress(b as Handler))
    } else {
      target.use(this.toExpress(a))
    }
  }

  route(
    stage: MiddlewareStage,
    method: HttpMethod,
    path: string,
    ...handlers: Handler[]
  ): void {
    const normalise = this.wildcardNormaliser(path)
    const chain = normalise ? [normalise, ...handlers] : handlers
    this.target(stage)
      .route(path)
      [method](...chain.map((h) => this.toExpress(h)))
  }

  mountRouter(prefix: string): void {
    this.appManager.mountRouter(prefix)
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.native.use(
      (
        err: unknown,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => this.toExpressError(handler)(err, req, res, next)
    )
  }

  bodyParsers(config: ServerBodyParserConfig): Handler[] {
    return this.bodyParserConfigurer.getMiddleware(config)
  }

  static(
    urlPath: string,
    directory: string,
    options: StaticOptions = {}
  ): void {
    this.native.use(urlPath, express.static(directory, options))
  }

  trustProxy(config: TrustProxyConfig): void {
    this.native.set('trust proxy', config.length ? config : false)
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

  /** Express 5 gives a trailing wildcard as an array; the contract says one string. */
  private wildcardNormaliser(path: string): Handler | null {
    const names = [...path.matchAll(/\/\*([A-Za-z_]\w*)/g)].map((m) => m[1])
    if (names.length === 0) return null
    return (req, _res, next) => {
      for (const name of names) {
        const value = req.params[name]
        if (Array.isArray(value)) req.params[name] = value.join('/')
      }
      next()
    }
  }

  private target(stage: MiddlewareStage): express.IRouter {
    return stage === 'app' ? this.native : this.getRouter()
  }

  // The neutral Handler types describe the augmented request and response
  // (see `augment`), which Express's own types do not know about.
  private toExpress(handler: Handler): express.RequestHandler {
    return handler as unknown as express.RequestHandler
  }

  private toExpressError(handler: ErrorHandler): express.ErrorRequestHandler {
    return handler as unknown as express.ErrorRequestHandler
  }

  private readonly augment = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    Object.assign(req, { node: req satisfies IncomingMessage })
    Object.defineProperty(res, 'handled', {
      get: () => res.headersSent || res.writableEnded,
      configurable: true,
    })
    Object.assign(res, {
      stream: (readable: Readable, options?: StreamOptions) =>
        this.streamTo(res, readable, options),
      // Express's own `header` is `set`, which adds a charset to text types
      header: (name: string, value: string) => {
        res.setHeader(name, value)
        return res
      },
    } satisfies Pick<HttpResponse, 'stream'> & { header: unknown })
    next()
  }

  private async streamTo(
    res: express.Response,
    readable: Readable,
    options: StreamOptions = {}
  ): Promise<void> {
    if (options.status) res.status(options.status)
    if (options.type) res.type(options.type)
    if (options.filename) res.attachment(options.filename)
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      res.setHeader(name, value)
    }
    try {
      await pipeline(readable, res)
    } catch (err) {
      // A client that goes away mid-stream is not a server error.
      const clientAborted =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === 'ERR_STREAM_PREMATURE_CLOSE'
      if (!clientAborted) throw err
    }
  }
}
