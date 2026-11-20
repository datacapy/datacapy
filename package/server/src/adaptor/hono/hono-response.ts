import { Readable } from 'stream'

import type { HttpResponse, StreamOptions } from '../types'
import {
  contentTypeForFile,
  resolveContentType,
  withCharset,
} from './content-type'

const NO_BODY_STATUSES = new Set([204, 205, 304])

function attachment(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/(["\\])/g, '\\$1')
  const encoded = encodeURIComponent(filename)
  return ascii === filename
    ? `attachment; filename="${ascii}"`
    : `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

/**
 * Collects what handlers say about the response and commits it once, as a Web
 * `Response`. The same object lives for the whole request, so headers set by
 * an early handler reach a later one's response.
 */
export class HonoResponse implements HttpResponse {
  statusCode = 200
  readonly headers = new Headers()
  readonly committed: Promise<Response>

  private resolveCommitted!: (response: Response) => void
  private isCommitted = false

  constructor() {
    this.committed = new Promise<Response>((resolve) => {
      this.resolveCommitted = resolve
    })
  }

  get headersSent(): boolean {
    return this.isCommitted
  }

  get handled(): boolean {
    return this.isCommitted
  }

  status(code: number): this {
    if (!this.isCommitted) this.statusCode = code
    return this
  }

  header(name: string, value: string): this {
    if (!this.isCommitted) this.headers.set(name, value)
    return this
  }

  append(name: string, value: string): this {
    if (!this.isCommitted) this.headers.append(name, value)
    return this
  }

  type(contentType: string): this {
    return this.header('Content-Type', resolveContentType(contentType))
  }

  json(data: unknown): this {
    if (!this.headers.has('Content-Type')) {
      this.headers.set('Content-Type', withCharset('application/json'))
    }
    return this.commit(data === undefined ? '' : JSON.stringify(data))
  }

  send(data?: unknown): this {
    if (data === undefined || data === null) return this.commit('')
    if (typeof data === 'string') {
      const current = this.headers.get('Content-Type')
      this.headers.set('Content-Type', withCharset(current ?? 'text/html'))
      return this.commit(data)
    }
    if (data instanceof Uint8Array) {
      if (!this.headers.has('Content-Type')) {
        this.headers.set('Content-Type', 'application/octet-stream')
      }
      return this.commit(data)
    }
    return this.json(data)
  }

  end(data?: string | Uint8Array): void {
    this.commit(data ?? '')
  }

  stream(readable: Readable, options: StreamOptions = {}): Promise<void> {
    if (this.isCommitted) {
      readable.destroy()
      return Promise.reject(new Error('Response already sent'))
    }
    if (options.status) this.statusCode = options.status
    if (options.type) this.type(options.type)
    if (options.filename) {
      this.headers.set('Content-Disposition', attachment(options.filename))
      if (!this.headers.has('Content-Type')) {
        this.headers.set('Content-Type', contentTypeForFile(options.filename))
      }
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      this.headers.set(name, value)
    }

    return new Promise<void>((resolve, reject) => {
      readable.once('error', (error) => {
        // Web stream cancellation (the client went away) destroys the source with an AbortError
        if (error.name === 'AbortError') resolve()
        else reject(error)
      })
      readable.once('close', () => resolve())
      this.commitResponse(
        new Response(Readable.toWeb(readable) as ReadableStream, {
          status: this.statusCode,
          headers: this.headers,
        })
      )
    })
  }

  private commit(body: string | Uint8Array): this {
    if (this.isCommitted) return this
    this.commitResponse(
      new Response(
        NO_BODY_STATUSES.has(this.statusCode)
          ? null
          : typeof body === 'string'
            ? body
            : new Uint8Array(body),
        {
          status: this.statusCode,
          headers: this.headers,
        }
      )
    )
    return this
  }

  private commitResponse(response: Response): void {
    this.isCommitted = true
    this.resolveCommitted(response)
  }
}
