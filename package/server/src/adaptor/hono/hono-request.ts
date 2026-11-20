import type { IncomingMessage } from 'http'
import querystring from 'querystring'

import type { HttpRequest } from '../types'

export interface PayloadError extends Error {
  status: number
  statusCode: number
  type: string
}

export function payloadError(
  status: number,
  type: string,
  message: string
): PayloadError {
  return Object.assign(new Error(message), { status, statusCode: status, type })
}

export class HonoRequest implements HttpRequest {
  readonly method: string
  readonly originalUrl: string
  readonly node: IncomingMessage
  readonly query: Record<string, unknown>
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string> = {}
  body: unknown = undefined
  aclContext?: unknown
  aclConditions?: unknown

  private readonly pathname: string
  private readonly search: string
  private base = ''

  constructor(
    private readonly raw: Request,
    node: IncomingMessage,
    private readonly resolveIp: (node: IncomingMessage) => string | undefined
  ) {
    const url = new URL(raw.url)
    this.pathname = url.pathname
    this.search = url.search
    this.method = raw.method
    this.originalUrl = url.pathname + url.search
    this.node = node
    this.headers = { ...node.headers }
    this.query = { ...querystring.parse(url.search.replace(/^\?/, '')) }
  }

  /** Makes `path` and `url` relative to `base`, as Express does inside a mount. */
  enter(base: string, params: Record<string, string>): void {
    this.base = base
    this.params = params
  }

  get path(): string {
    return this.relative(this.pathname)
  }

  get url(): string {
    return this.relative(this.pathname) + this.search
  }

  get ip(): string | undefined {
    return this.resolveIp(this.node)
  }

  get(name: string): string | undefined {
    const value = this.headers[name.toLowerCase()]
    return Array.isArray(value) ? value[0] : value
  }

  /** The body as bytes, rejecting with a 413 error once it passes `limit`. */
  async readBody(limit: number): Promise<Buffer> {
    const declared = Number(this.get('content-length'))
    if (declared > limit) throw this.tooLarge(limit)
    if (!this.raw.body) return Buffer.alloc(0)

    const chunks: Uint8Array[] = []
    let total = 0
    const reader = this.raw.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel()
        throw this.tooLarge(limit)
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  }

  private tooLarge(limit: number): PayloadError {
    return payloadError(
      413,
      'entity.too.large',
      `request entity too large (limit ${limit} bytes)`
    )
  }

  private relative(pathname: string): string {
    const base = this.base
    if (!base || base === '/') return pathname
    if (pathname === base) return '/'
    return pathname.startsWith(base + '/')
      ? pathname.slice(base.length)
      : pathname
  }
}
