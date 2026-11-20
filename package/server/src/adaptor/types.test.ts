import { createServer } from 'http'
import type { Server } from 'http'

import type {
  ErrorHandler,
  Handler,
  HttpAdaptor,
  HttpMethod,
  MiddlewareStage,
} from './types'

interface Registration {
  stage: MiddlewareStage
  method?: HttpMethod
  path?: string
  handler: Handler
}

class RecordingAdaptor implements HttpAdaptor<Registration[]> {
  readonly native: Registration[] = []
  readonly server: Server = createServer()
  mountedAt: string | null = null
  errorHandler: ErrorHandler | null = null
  trusted: string[] = []

  use(stage: MiddlewareStage, a: string | Handler, b?: Handler): void {
    if (typeof a === 'string') {
      this.native.push({ stage, path: a, handler: b as Handler })
    } else {
      this.native.push({ stage, handler: a })
    }
  }

  route(
    stage: MiddlewareStage,
    method: HttpMethod,
    path: string,
    ...handlers: Handler[]
  ): void {
    for (const handler of handlers) {
      this.native.push({ stage, method, path, handler })
    }
  }

  mountRouter(prefix: string): void {
    this.mountedAt = prefix
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.errorHandler = handler
  }

  bodyParsers(): Handler[] {
    return []
  }

  static(): void {}

  trustProxy(config: string[]): void {
    this.trusted = config
  }

  async listen(): Promise<void> {}

  async close(): Promise<void> {}
}

describe('HttpAdaptor contract', () => {
  it('can be implemented without importing any framework', () => {
    const adaptor = new RecordingAdaptor()
    const handler: Handler = (_req, _res, next) => next()

    adaptor.use('app', handler)
    adaptor.use('router', '/x', handler)
    adaptor.route('app', 'get', '/storage/:bucket/*key', handler)
    adaptor.mountRouter('/api')
    adaptor.trustProxy(['loopback'])

    expect(adaptor.native.map((r) => [r.stage, r.method, r.path])).toEqual([
      ['app', undefined, undefined],
      ['router', undefined, '/x'],
      ['app', 'get', '/storage/:bucket/*key'],
    ])
    expect(adaptor.mountedAt).toBe('/api')
    expect(adaptor.trusted).toEqual(['loopback'])
  })
})
