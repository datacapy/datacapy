import * as fs from 'fs'
import * as http from 'http'
import * as os from 'os'
import * as path from 'path'
import type { AddressInfo } from 'net'
import { Readable } from 'stream'

import type { HttpAdaptor, Handler } from '../adaptor/types'
import type { ServerApiConfig } from '../api-config'
import ServerRemoteObject from '../remote-object'
import { ServerErrorNotFound } from '../error'
import { allowConsole } from './consoleGuard'

const noteConfig = {
  service: 'note',
  enable: true,
  acl: { rules: [{ allow: false, role: 'all' }] },
  endpoints: {
    patchNote: {
      method: 'patch',
      verbs: ['patch'],
      path: '/:noteId',
      data: {
        noteId: { src: 'param', required: true, type: String },
        projectId: {
          src: 'header',
          srcPath: 'X-Project-Id',
          required: true,
          type: String,
        },
        changes: { src: 'body', required: true, type: Array },
        page: { src: 'query', required: false, type: Number, defaultValue: 1 },
      },
      acl: { rules: [{ allow: true, role: 'all' }] },
    },
    secret: {
      method: 'secret',
      verbs: ['get'],
      path: '/secret',
      data: {},
      acl: { rules: [{ allow: true, role: 'nobody' }] },
    },
    missing: {
      method: 'missing',
      verbs: ['get'],
      path: '/missing',
      data: {},
      acl: { rules: [{ allow: true, role: 'all' }] },
    },
    crash: {
      method: 'crash',
      verbs: ['get'],
      path: '/crash',
      data: {},
      acl: { rules: [{ allow: true, role: 'all' }] },
    },
    csv: {
      method: 'csv',
      verbs: ['get'],
      path: '/csv',
      data: { response: { src: 'container', required: true } },
      acl: { rules: [{ allow: true, role: 'all' }] },
    },
  },
} satisfies ServerApiConfig

/**
 * Behaviour every `HttpAdaptor` must share, run over real HTTP. Express and
 * any later adaptor call this with a factory; a difference between adaptors
 * fails here, not in veysur.
 */
export interface ConformanceOptions {
  /** The framework logs a failing source stream itself (with console.error). */
  logsSourceStreamErrors?: boolean
}

export function runAdaptorConformance(
  label: string,
  create: () => HttpAdaptor,
  options: ConformanceOptions = {}
): void {
  describe(`${label} adaptor conformance`, () => {
    let adaptor: HttpAdaptor
    let base: string
    let port: number

    async function start(): Promise<void> {
      await adaptor.listen(0)
      port = (adaptor.server.address() as AddressInfo).port
      base = `http://127.0.0.1:${port}`
    }

    const json =
      (build: (req: Parameters<Handler>[0]) => unknown): Handler =>
      (req, res) => {
        res.json(build(req))
      }

    beforeEach(() => {
      adaptor = create()
    })

    afterEach(async () => {
      if (adaptor.server.listening) await adaptor.close()
    })

    describe('routing', () => {
      it('passes params, query, headers and method to the handler', async () => {
        adaptor.route(
          'app',
          'get',
          '/p/:id',
          json((req) => ({
            id: req.params.id,
            query: req.query,
            header: req.get('x-thing'),
            method: req.method,
            path: req.path,
          }))
        )
        await start()

        const res = await fetch(`${base}/p/7?a=1&b=two`, {
          headers: { 'X-Thing': 'yes' },
        })

        expect(await res.json()).toEqual({
          id: '7',
          query: { a: '1', b: 'two' },
          header: 'yes',
          method: 'GET',
          path: '/p/7',
        })
      })

      it('gives a trailing wildcard as the rest of the path in one string', async () => {
        adaptor.route(
          'app',
          'get',
          '/storage/:bucket/*key',
          json((req) => ({ bucket: req.params.bucket, key: req.params.key }))
        )
        await start()

        const body = await (await fetch(`${base}/storage/b1/a/b.txt`)).json()

        expect(body).toEqual({ bucket: 'b1', key: 'a/b.txt' })
      })

      it('matches a path with a trailing slash', async () => {
        adaptor.route(
          'app',
          'get',
          '/p/:id',
          json((req) => req.params)
        )
        await start()

        const res = await fetch(`${base}/p/7/`)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ id: '7' })
      })

      it('matches a route registered with a trailing slash with or without one', async () => {
        adaptor.route(
          'router',
          'get',
          '/ping/',
          json(() => 'pong')
        )
        adaptor.mountRouter('/api')
        await start()

        expect(await (await fetch(`${base}/api/ping`)).json()).toBe('pong')
        expect(await (await fetch(`${base}/api/ping/`)).json()).toBe('pong')
      })

      it('answers 404 for an unmatched path and method', async () => {
        adaptor.route(
          'app',
          'get',
          '/only',
          json(() => ({}))
        )
        await start()

        expect((await fetch(`${base}/other`)).status).toBe(404)
        expect((await fetch(`${base}/only`, { method: 'POST' })).status).toBe(
          404
        )
      })

      it('runs every registered verb', async () => {
        for (const method of ['put', 'patch', 'delete'] as const) {
          adaptor.route(
            'app',
            method,
            '/v',
            json((req) => req.method)
          )
        }
        await start()

        for (const method of ['PUT', 'PATCH', 'DELETE']) {
          const res = await fetch(`${base}/v`, { method })
          expect(await res.json()).toBe(method)
        }
      })
    })

    describe('middleware stages', () => {
      it('runs app handlers before router handlers, in registration order', async () => {
        const order: string[] = []
        const mark =
          (name: string): Handler =>
          (_req, _res, next) => {
            order.push(name)
            next()
          }
        adaptor.use('router', mark('router-1'))
        adaptor.use('app', mark('app-1'))
        adaptor.use('app', mark('app-2'))
        adaptor.use('router', mark('router-2'))
        adaptor.route(
          'router',
          'get',
          '/p',
          json(() => order)
        )
        adaptor.mountRouter('/api')
        await start()

        const body = await (await fetch(`${base}/api/p`)).json()

        expect(body).toEqual(['app-1', 'app-2', 'router-1', 'router-2'])
      })

      it('serves router routes only under the mount prefix', async () => {
        adaptor.route(
          'router',
          'get',
          '/p',
          json(() => 'router')
        )
        adaptor.route(
          'app',
          'get',
          '/q',
          json(() => 'app')
        )
        adaptor.mountRouter('/api')
        await start()

        expect((await fetch(`${base}/api/p`)).status).toBe(200)
        expect((await fetch(`${base}/p`)).status).toBe(404)
        expect(await (await fetch(`${base}/q`)).json()).toBe('app')
      })

      it('applies a path-scoped use only under that path', async () => {
        adaptor.use('app', '/only', (_req, res) => {
          res.send('scoped')
        })
        await start()

        expect(await (await fetch(`${base}/only/x`)).text()).toBe('scoped')
        expect((await fetch(`${base}/other`)).status).toBe(404)
      })

      it('gives a path-scoped handler a req.path relative to its path', async () => {
        adaptor.use(
          'app',
          '/api/locale',
          json((req) => ({ path: req.path, original: req.originalUrl }))
        )
        await start()

        const body = await (
          await fetch(`${base}/api/locale/en/x.json?v=1`)
        ).json()

        expect(body).toEqual({
          path: '/en/x.json',
          original: '/api/locale/en/x.json?v=1',
        })
      })

      it('lets an app handler set a header on a later response', async () => {
        adaptor.use('app', (_req, res, next) => {
          res.header('X-Api-Version', '9')
          next()
        })
        adaptor.route(
          'app',
          'get',
          '/p',
          json(() => ({}))
        )
        await start()

        expect((await fetch(`${base}/p`)).headers.get('x-api-version')).toBe(
          '9'
        )
      })

      it('lets a handler end the request without calling next', async () => {
        const reached: string[] = []
        adaptor.use('app', (_req, res) => {
          res.status(418).send('stop')
        })
        adaptor.route('app', 'get', '/p', (_req, res) => {
          reached.push('route')
          res.send('route')
        })
        await start()

        const res = await fetch(`${base}/p`)

        expect(res.status).toBe(418)
        expect(reached).toEqual([])
      })
    })

    describe('request bodies', () => {
      const send = (url: string, type: string, body: BodyInit) =>
        fetch(url, { method: 'POST', headers: { 'content-type': type }, body })

      it('parses json, urlencoded and text bodies when enabled', async () => {
        const parsers = adaptor.bodyParsers({
          json: { enable: true, limit: '100kb' },
          urlencoded: { enable: true, limit: '100kb', extended: true },
          text: { enable: true, limit: '100kb', type: 'text/plain' },
        })
        adaptor.route(
          'app',
          'post',
          '/b',
          ...parsers,
          json((req) => req.body)
        )
        await start()

        expect(
          await (await send(`${base}/b`, 'application/json', '{"a":1}')).json()
        ).toEqual({ a: 1 })
        expect(
          await (
            await send(
              `${base}/b`,
              'application/x-www-form-urlencoded',
              'a=1&b[c]=2'
            )
          ).json()
        ).toEqual({ a: '1', b: { c: '2' } })
        expect(
          await (await send(`${base}/b`, 'text/plain', 'hello')).json()
        ).toBe('hello')
      })

      it('leaves a raw body as a Buffer of the exact bytes', async () => {
        adaptor.route(
          'app',
          'post',
          '/raw',
          ...adaptor.bodyParsers({
            json: { enable: false },
            raw: {
              enable: true,
              limit: '100kb',
              type: 'application/octet-stream',
            },
          }),
          json((req) => ({
            isBuffer: Buffer.isBuffer(req.body),
            bytes: [...req.body],
          }))
        )
        await start()

        const res = await send(
          `${base}/raw`,
          'application/octet-stream',
          new Uint8Array([0, 1, 255])
        )

        expect(await res.json()).toEqual({ isBuffer: true, bytes: [0, 1, 255] })
      })

      it('rejects a body over the limit with 413', async () => {
        adaptor.route(
          'app',
          'post',
          '/small',
          ...adaptor.bodyParsers({ json: { enable: true, limit: '10b' } }),
          json((req) => req.body)
        )
        await start()

        const res = await send(
          `${base}/small`,
          'application/json',
          JSON.stringify({ long: 'x'.repeat(100) })
        )

        expect(res.status).toBe(413)
      })

      it('applies the limit per route', async () => {
        adaptor.route(
          'app',
          'post',
          '/small',
          ...adaptor.bodyParsers({ json: { enable: true, limit: '10b' } }),
          json(() => 'ok')
        )
        adaptor.route(
          'app',
          'post',
          '/large',
          ...adaptor.bodyParsers({ json: { enable: true, limit: '1mb' } }),
          json(() => 'ok')
        )
        await start()
        const body = JSON.stringify({ long: 'x'.repeat(100) })

        expect(
          (await send(`${base}/small`, 'application/json', body)).status
        ).toBe(413)
        expect(
          (await send(`${base}/large`, 'application/json', body)).status
        ).toBe(200)
      })
    })

    describe('endpoints through RemoteObject', () => {
      const calls: unknown[] = []

      beforeEach(async () => {
        calls.length = 0
        const service = {
          patch: async (args: unknown) => {
            calls.push(args)
            return { saved: true }
          },
          secret: async () => 'hidden',
          missing: async () => {
            throw new ServerErrorNotFound('no such note')
          },
          crash: async () => {
            throw new Error('database exploded')
          },
          csv: async ({ response }: { response: Parameters<Handler>[1] }) => {
            response.type('text/csv')
            await response.stream(Readable.from(['a,b\n', '1,2\n']))
          },
        }
        new ServerRemoteObject(service, {
          path: '/note',
          ...noteConfig,
        }).registerRoutes(adaptor)
        adaptor.mountRouter('/api')
        await start()
      })

      const patch = (body: unknown, headers: Record<string, string> = {}) =>
        fetch(`${base}/api/note/n1?page=3`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Project-Id': 'p1',
            ...headers,
          },
          body: JSON.stringify(body),
        })

      it('passes param, header, body and query to the service method', async () => {
        const res = await patch({ changes: [{ id: 'a' }] })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ saved: true })
        expect(calls[0]).toMatchObject({
          noteId: 'n1',
          projectId: 'p1',
          changes: [{ id: 'a' }],
          page: 3,
        })
      })

      it('answers 403 with validationErrors when a required field is missing', async () => {
        const res = await fetch(`${base}/api/note/n1`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: [] }),
        })

        expect(res.status).toBe(403)
        expect(Object.keys(await res.json())).toEqual(['validationErrors'])
        expect(calls).toEqual([])
      })

      it('answers 401 when no ACL rule allows the caller', async () => {
        const res = await fetch(`${base}/api/note/secret`)

        expect(res.status).toBe(401)
        expect(calls).toEqual([])
      })

      it('maps a ServerError to its status and body', async () => {
        const res = await fetch(`${base}/api/note/missing`)

        expect(res.status).toBe(404)
        expect(res.headers.get('content-type')).toContain('application/json')
      })

      it('answers an unexpected error with a 500 and no internals', async () => {
        const res = await fetch(`${base}/api/note/crash`)
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error).toBe('InternalServerError')
        expect(JSON.stringify(body)).not.toContain('database exploded')
      })

      it('lets an endpoint stream its own response without a second write', async () => {
        const res = await fetch(`${base}/api/note/csv`)

        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/csv')
        expect(await res.text()).toBe('a,b\n1,2\n')
      })
    })

    describe('streaming', () => {
      it('sends type, headers and filename, and marks the response handled', async () => {
        const seen: { before?: boolean; after?: boolean } = {}
        adaptor.route('app', 'get', '/csv', async (_req, res) => {
          seen.before = res.handled
          await res.stream(Readable.from(['a,b\n', '1,2\n']), {
            status: 201,
            type: 'text/csv',
            filename: 'out.csv',
            headers: { 'X-Extra': 'yes' },
          })
          seen.after = res.handled
        })
        await start()

        const res = await fetch(`${base}/csv`)
        const text = await res.text()

        expect(res.status).toBe(201)
        expect(res.headers.get('content-type')).toContain('text/csv')
        expect(res.headers.get('content-disposition')).toContain('out.csv')
        expect(res.headers.get('x-extra')).toBe('yes')
        expect(text).toBe('a,b\n1,2\n')
        expect(seen).toEqual({ before: false, after: true })
      })

      it('delivers a large body intact', async () => {
        const chunks = 400
        const chunk = Buffer.alloc(65536, 7)
        adaptor.route('app', 'get', '/large', async (_req, res) => {
          let n = 0
          await res.stream(
            new Readable({
              read() {
                this.push(n++ < chunks ? chunk : null)
              },
            })
          )
        })
        await start()

        const body = Buffer.from(
          await (await fetch(`${base}/large`)).arrayBuffer()
        )

        expect(body.length).toBe(chunks * chunk.length)
        expect(body.every((byte) => byte === 7)).toBe(true)
      })

      it('stops reading the source while the client is not reading', async () => {
        let produced = 0
        adaptor.route('app', 'get', '/endless', async (_req, res) => {
          await res.stream(
            new Readable({
              read() {
                produced += 65536
                this.push(Buffer.alloc(65536))
              },
            })
          )
        })
        await start()

        await new Promise<void>((resolve) => {
          http.get(`${base}/endless`, (response) => {
            response.pause()
            setTimeout(() => {
              response.destroy()
              resolve()
            }, 500)
          })
        })

        expect(produced).toBeLessThan(64 * 1024 * 1024)
      })

      it('destroys the source and does not throw when the client aborts', async () => {
        const outcome: { error?: unknown; sourceClosed?: boolean } = {}
        let started: () => void
        const sourceStarted = new Promise<void>(
          (resolve) => (started = resolve)
        )
        adaptor.route('app', 'get', '/big', async (_req, res) => {
          const source = new Readable({
            read() {
              this.push(Buffer.alloc(65536))
              started()
            },
          })
          source.on('close', () => (outcome.sourceClosed = true))
          try {
            await res.stream(source)
          } catch (error) {
            outcome.error = error
          }
        })
        await start()

        const controller = new AbortController()
        const res = await fetch(`${base}/big`, { signal: controller.signal })
        await sourceStarted
        await (res.body as ReadableStream).getReader().read()
        controller.abort()
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(outcome.error).toBeUndefined()
        expect(outcome.sourceClosed).toBe(true)
      })

      it('rejects when the source stream fails and the client sees a broken response', async () => {
        const outcome: { error?: unknown } = {}
        adaptor.route('app', 'get', '/bad', async (_req, res) => {
          const source = new Readable({
            read() {
              this.push('partial')
              this.destroy(new Error('source failed'))
            },
          })
          try {
            await res.stream(source)
          } catch (error) {
            outcome.error = error
          }
        })
        await start()

        const attempt = async () => {
          const read = fetch(`${base}/bad`).then((res) => res.text())
          await expect(read).rejects.toBeDefined()
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        if (options.logsSourceStreamErrors) {
          await allowConsole('source failed', attempt)
        } else {
          await attempt()
        }

        expect(outcome.error).toEqual(new Error('source failed'))
      })
    })

    describe('headers and cookies', () => {
      it('keeps both values when Set-Cookie is appended twice', async () => {
        adaptor.route('app', 'get', '/c', (_req, res) => {
          res.append('Set-Cookie', 'a=1; Path=/')
          res.append('Set-Cookie', 'b=2; Path=/')
          res.send('ok')
        })
        await start()

        const res = await fetch(`${base}/c`)

        expect(res.headers.getSetCookie()).toEqual([
          'a=1; Path=/',
          'b=2; Path=/',
        ])
      })

      it('replaces a header set with header()', async () => {
        adaptor.route('app', 'get', '/h', (_req, res) => {
          res.header('X-A', '1')
          res.header('X-A', '2')
          res.send('ok')
        })
        await start()

        expect((await fetch(`${base}/h`)).headers.get('x-a')).toBe('2')
      })

      it('sets a header value exactly as given', async () => {
        adaptor.route('app', 'get', '/h', (_req, res) => {
          res.header('Content-Type', 'text/plain')
          res.end('ok')
        })
        await start()

        expect((await fetch(`${base}/h`)).headers.get('content-type')).toBe(
          'text/plain'
        )
      })

      it('gives the request headers lower-cased', async () => {
        adaptor.route(
          'app',
          'get',
          '/h',
          json((req) => req.headers['x-project-id'])
        )
        await start()

        const res = await fetch(`${base}/h`, {
          headers: { 'X-Project-Id': 'p1' },
        })

        expect(await res.json()).toBe('p1')
      })

      it('exposes the raw Node request', async () => {
        adaptor.route(
          'app',
          'get',
          '/n',
          json((req) => ({
            hasNode: typeof req.node?.socket?.remoteAddress === 'string',
          }))
        )
        await start()

        expect(await (await fetch(`${base}/n`)).json()).toEqual({
          hasNode: true,
        })
      })
    })

    describe('client ip and trusted proxies', () => {
      async function ipWith(
        trusted: string[],
        forwarded?: string
      ): Promise<string | undefined> {
        adaptor.trustProxy(trusted)
        adaptor.route(
          'app',
          'get',
          '/ip',
          json((req) => ({ ip: req.ip }))
        )
        await start()
        const res = await fetch(`${base}/ip`, {
          headers: forwarded ? { 'X-Forwarded-For': forwarded } : {},
        })
        return (await res.json()).ip
      }

      it('is the socket address when no proxy is trusted, whatever X-Forwarded-For says', async () => {
        expect(await ipWith([], '1.2.3.4')).toMatch(/127\.0\.0\.1$/)
      })

      it('is the socket address when the peer is not in the trusted list', async () => {
        expect(await ipWith(['10.0.0.0/8'], '1.2.3.4')).toMatch(/127\.0\.0\.1$/)
      })

      it('uses X-Forwarded-For from a trusted preset peer', async () => {
        expect(await ipWith(['loopback'], '1.2.3.4')).toBe('1.2.3.4')
      })

      it('uses X-Forwarded-For from a peer in a trusted CIDR range', async () => {
        expect(await ipWith(['127.0.0.0/8'], '1.2.3.4')).toBe('1.2.3.4')
      })

      it('ignores a spoofed leftmost entry and takes the first untrusted hop from the right', async () => {
        expect(await ipWith(['loopback'], '9.9.9.9, 1.2.3.4')).toBe('1.2.3.4')
      })

      it('skips trusted hops on the right of the chain', async () => {
        expect(
          await ipWith(['loopback', '10.0.0.0/8'], '1.2.3.4, 10.1.1.1')
        ).toBe('1.2.3.4')
      })

      it('is the socket address when a trusted peer sends no header', async () => {
        expect(await ipWith(['loopback'])).toMatch(/127\.0\.0\.1$/)
      })
    })

    describe('static files', () => {
      let directory: string

      beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptor-static-'))
        fs.writeFileSync(path.join(directory, 'hello.txt'), 'hello')
      })

      afterEach(() => {
        fs.rmSync(directory, { recursive: true, force: true })
      })

      it('serves a file under the url path', async () => {
        adaptor.static('/files', directory)
        await start()

        const res = await fetch(`${base}/files/hello.txt`)

        expect(res.status).toBe(200)
        expect(await res.text()).toBe('hello')
      })

      it('passes a missing file on to later routes', async () => {
        adaptor.static('/files', directory)
        adaptor.route(
          'app',
          'get',
          '/files/:name',
          json((req) => req.params.name)
        )
        await start()

        const res = await fetch(`${base}/files/other.txt`)

        expect(await res.json()).toBe('other.txt')
      })

      it('sets max-age from the options', async () => {
        adaptor.static('/files', directory, { maxAge: 60_000 })
        await start()

        const res = await fetch(`${base}/files/hello.txt`)

        expect(res.headers.get('cache-control')).toContain('max-age=60')
      })
    })

    describe('errors', () => {
      it('sends a thrown error from a handler to the error handler', async () => {
        adaptor.route('app', 'get', '/boom', () => {
          throw new Error('boom')
        })
        adaptor.setErrorHandler((err, _req, res) => {
          res.status(500).json({ message: (err as Error).message })
        })
        await start()

        const res = await fetch(`${base}/boom`)

        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ message: 'boom' })
      })

      it('sends a rejected promise from an async handler to the error handler', async () => {
        adaptor.route('app', 'get', '/boom', async () => {
          throw new Error('async boom')
        })
        adaptor.setErrorHandler((err, _req, res) => {
          res.status(500).json({ message: (err as Error).message })
        })
        await start()

        const res = await fetch(`${base}/boom`)

        expect(await res.json()).toEqual({ message: 'async boom' })
      })

      it('sends an error passed to next to the error handler', async () => {
        adaptor.use('app', (_req, _res, next) => next(new Error('via next')))
        adaptor.setErrorHandler((err, _req, res) => {
          res.status(502).json({ message: (err as Error).message })
        })
        await start()

        const res = await fetch(`${base}/anything`)

        expect(res.status).toBe(502)
        expect(await res.json()).toEqual({ message: 'via next' })
      })
    })

    describe('lifecycle', () => {
      it('resolves listen once the server is listening', async () => {
        await adaptor.listen(0)

        expect(adaptor.server.listening).toBe(true)
      })

      it('close destroys open connections, resolves, and refuses new ones', async () => {
        adaptor.route('app', 'get', '/hang', () => {})
        await start()
        const pending = fetch(`${base}/hang`).then(
          () => 'answered',
          () => 'closed'
        )
        await new Promise((resolve) => setTimeout(resolve, 100))

        await adaptor.close()

        expect(await pending).toBe('closed')
        expect(adaptor.server.listening).toBe(false)
        await expect(fetch(`${base}/hang`)).rejects.toBeDefined()
      })
    })
  })
}
