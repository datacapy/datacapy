import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { AddressInfo } from 'net'

import { HonoAdaptor } from './hono-adaptor'
import { parseLimit } from './limit'
import { toHonoPath } from './route-path'
import { resolveContentType, withCharset } from './content-type'
import type { Handler } from '../types'

const logger = { error: jest.fn(), info: jest.fn() }

describe('parseLimit', () => {
  it('reads numbers and units, and falls back to 100kb', () => {
    expect(parseLimit(500)).toBe(500)
    expect(parseLimit('10b')).toBe(10)
    expect(parseLimit('100kb')).toBe(102400)
    expect(parseLimit('1.5MB')).toBe(1572864)
    expect(parseLimit('1gb')).toBe(1024 ** 3)
    expect(parseLimit(false)).toBe(102400)
    expect(parseLimit(true)).toBe(102400)
    expect(parseLimit('lots')).toBe(102400)
    expect(parseLimit(undefined)).toBe(102400)
  })
})

describe('toHonoPath', () => {
  it('turns a trailing named wildcard into a regex param and leaves other paths alone', () => {
    expect(toHonoPath('/storage/:bucket/*key')).toBe(
      '/storage/:bucket/:key{.+}'
    )
    expect(toHonoPath('/p/:id')).toBe('/p/:id')
    expect(toHonoPath('/plain')).toBe('/plain')
    expect(toHonoPath('/ping/')).toBe('/ping')
    expect(toHonoPath('/')).toBe('/')
  })
})

describe('content types', () => {
  it('adds a charset to text and json types only', () => {
    expect(withCharset('text/csv')).toBe('text/csv; charset=utf-8')
    expect(withCharset('application/json')).toBe(
      'application/json; charset=utf-8'
    )
    expect(withCharset('image/png')).toBe('image/png')
    expect(withCharset('text/plain; charset=latin1')).toBe(
      'text/plain; charset=latin1'
    )
  })

  it('resolves bare extensions', () => {
    expect(resolveContentType('json')).toBe('application/json; charset=utf-8')
    expect(resolveContentType('csv')).toBe('text/csv; charset=utf-8')
    expect(resolveContentType('nonsense-ext')).toBe('application/octet-stream')
  })
})

describe('HonoAdaptor specifics', () => {
  let adaptor: HonoAdaptor
  let base: string

  async function start(): Promise<void> {
    await adaptor.listen(0)
    base = `http://127.0.0.1:${(adaptor.server.address() as AddressInfo).port}`
  }

  const json =
    (build: (req: Parameters<Handler>[0]) => unknown): Handler =>
    (req, res) => {
      res.json(build(req))
    }

  beforeEach(() => {
    adaptor = new HonoAdaptor({ path: '/api', port: 0 }, logger, async () => {})
  })

  afterEach(async () => {
    if (adaptor.server.listening) await adaptor.close()
  })

  it('refuses router-stage registrations after the router is mounted', () => {
    adaptor.mountRouter('/api')

    expect(() => adaptor.use('router', (_req, _res, next) => next())).toThrow(
      /already mounted/
    )
  })

  it('rejects listen when the port is taken', async () => {
    await adaptor.listen(0)
    const { port } = adaptor.server.address() as AddressInfo
    const second = new HonoAdaptor(
      { path: '/api', port: 0 },
      logger,
      async () => {}
    )

    await expect(second.listen(port)).rejects.toMatchObject({
      code: 'EADDRINUSE',
    })
  })

  describe('body parser errors', () => {
    beforeEach(async () => {
      adaptor.route(
        'app',
        'post',
        '/json',
        ...adaptor.bodyParsers({ json: { enable: true, limit: '1kb' } }),
        json((req) => req.body ?? null)
      )
      await start()
    })

    const post = (body: string, type = 'application/json') =>
      fetch(`${base}/json`, {
        method: 'POST',
        headers: { 'content-type': type },
        body,
      })

    it('answers 400 for malformed json and for a bare scalar', async () => {
      expect((await post('{"a":')).status).toBe(400)
      expect((await post('"just a string"')).status).toBe(400)
    })

    it('treats an empty json body as an empty object', async () => {
      expect(await (await post('')).json()).toEqual({})
    })

    it('answers 413 early from Content-Length without reading the body', async () => {
      expect((await post('x'.repeat(5000))).status).toBe(413)
    })

    it('answers 415 for an unsupported charset', async () => {
      expect(
        (await post('{}', 'application/json; charset=utf-16')).status
      ).toBe(415)
    })

    it('leaves the body unparsed when the content type does not match', async () => {
      expect(await (await post('{"a":1}', 'text/plain')).json()).toBeNull()
    })
  })

  describe('default error response', () => {
    it('uses the error status and message below 500, and hides the message at 500', async () => {
      adaptor.route('app', 'get', '/teapot', () => {
        throw Object.assign(new Error('short and stout'), { status: 418 })
      })
      adaptor.route('app', 'get', '/crash', () => {
        throw new Error('secret detail')
      })
      await start()

      const teapot = await fetch(`${base}/teapot`)
      const crash = await fetch(`${base}/crash`)

      expect(teapot.status).toBe(418)
      expect(await teapot.text()).toBe('short and stout')
      expect(crash.status).toBe(500)
      expect(await crash.text()).toBe('Internal Server Error')
    })

    it('falls back to the default when the error handler passes the error on', async () => {
      adaptor.route('app', 'get', '/crash', () => {
        throw new Error('x')
      })
      adaptor.setErrorHandler((_err, _req, _res, next) => next())
      await start()

      expect((await fetch(`${base}/crash`)).status).toBe(500)
    })
  })

  describe('headers carried to responses Hono makes itself', () => {
    it('keeps a header set by middleware on a 404', async () => {
      adaptor.use('app', (_req, res, next) => {
        res.header('X-Api-Version', '3')
        next()
      })
      await start()

      const res = await fetch(`${base}/nothing-here`)

      expect(res.status).toBe(404)
      expect(res.headers.get('x-api-version')).toBe('3')
    })
  })

  describe('request fields', () => {
    it('shares header changes between handlers and exposes url, originalUrl and path under a mount', async () => {
      adaptor.use('router', (req, _res, next) => {
        req.headers['x-project-id'] = 'p9'
        next()
      })
      adaptor.route(
        'router',
        'get',
        '/where',
        json((req) => ({
          project: req.get('X-Project-Id'),
          url: req.url,
          originalUrl: req.originalUrl,
          path: req.path,
        }))
      )
      adaptor.mountRouter('/api')
      await start()

      const body = await (await fetch(`${base}/api/where?a=1`)).json()

      expect(body).toEqual({
        project: 'p9',
        url: '/where?a=1',
        originalUrl: '/api/where?a=1',
        path: '/where',
      })
    })

    it('gives repeated query keys as an array', async () => {
      adaptor.route(
        'app',
        'get',
        '/q',
        json((req) => req.query)
      )
      await start()

      const body = await (await fetch(`${base}/q?a=1&a=2&b=3`)).json()

      expect(body).toEqual({ a: ['1', '2'], b: '3' })
    })
  })

  describe('client ip', () => {
    async function ipFor(
      trusted: string[],
      forwarded: string
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
        headers: { 'X-Forwarded-For': forwarded },
      })
      return ((await res.json()) as { ip: string }).ip
    }

    it('handles IPv6 addresses and mixed chains', async () => {
      expect(await ipFor(['loopback'], '2001:db8::1')).toBe('2001:db8::1')
    })

    it('stops at the first untrusted hop even when a trusted one sits further left', async () => {
      expect(await ipFor(['loopback', '10.0.0.0/8'], '10.9.9.9, 1.2.3.4')).toBe(
        '1.2.3.4'
      )
    })
  })

  describe('static files', () => {
    let directory: string

    beforeEach(() => {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hono-static-'))
      fs.writeFileSync(path.join(directory, 'a.txt'), 'AAA')
      fs.mkdirSync(path.join(directory, 'sub'))
      fs.writeFileSync(path.join(directory, 'sub', 'index.html'), '<p>idx</p>')
    })

    afterEach(() => {
      fs.rmSync(directory, { recursive: true, force: true })
    })

    it('serves an index file for a directory, with type, etag and 304 on a match', async () => {
      adaptor.static('/files', directory)
      await start()

      const first = await fetch(`${base}/files/sub/`)
      const etag = first.headers.get('etag') as string
      const second = await fetch(`${base}/files/sub/`, {
        headers: { 'If-None-Match': etag },
      })

      expect(first.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(await first.text()).toBe('<p>idx</p>')
      expect(second.status).toBe(304)
    })

    it('answers HEAD with headers and no body', async () => {
      adaptor.static('/files', directory)
      await start()

      const res = await fetch(`${base}/files/a.txt`, { method: 'HEAD' })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-length')).toBe('3')
      expect(await res.text()).toBe('')
    })

    it('does not serve paths outside the directory', async () => {
      adaptor.static('/files', directory)
      await start()

      for (const attempt of [
        '/files/../a.txt',
        '/files/%2e%2e/a.txt',
        '/files/..%2fa.txt',
      ]) {
        const res = await fetch(`${base}${attempt}`)
        expect(await res.text()).not.toBe('AAA')
      }
    })

    it('answers 404 instead of passing on when fallthrough is false', async () => {
      adaptor.static('/files', directory, { fallthrough: false })
      adaptor.route(
        'app',
        'get',
        '/files/:name',
        json(() => 'later')
      )
      await start()

      expect((await fetch(`${base}/files/missing.txt`)).status).toBe(404)
    })

    it('reads string max-age durations', async () => {
      adaptor.static('/files', directory, { maxAge: '1d' })
      await start()

      const res = await fetch(`${base}/files/a.txt`)

      expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    })
  })
})
