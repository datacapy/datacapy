import { Readable } from 'stream'
import type { AddressInfo } from 'net'
import { ModelManager } from '@datacapy/om'

import Server from './server'
import type { HttpResponse } from './adaptor/types'

describe.each(['express', 'hono'] as const)(
  'Server on the %s adaptor',
  (adaptor) => {
    let server: Server
    let base: string
    const order: string[] = []

    beforeAll(async () => {
      server = new Server(
        { path: '/api', port: 0, adaptor },
        new ModelManager()
      )
      server.setLogger({ error: () => undefined, info: () => undefined })
      server.addInitialiser((s: Server) => {
        s.use('router', (_req, _res, next) => {
          order.push('router-init')
          next()
        })
      }, '00-init')
      server.addInitialiser((s: Server) => {
        s.use('app', (_req, res, next) => {
          res.header('X-Mounted', 'yes')
          next()
        })
      }, '04-router-mounted')
      server.addApiConfig({
        object: {
          hello: async ({ name }: { name: string }) => ({ hi: name }),
          csv: async ({ response }: { response: HttpResponse }) => {
            await response.stream(Readable.from(['a\n', 'b\n']), {
              type: 'text/csv',
            })
          },
          boom: async () => {
            throw new Error('x')
          },
        },
        path: '/t',
        acl: { rules: [{ role: 'all', allow: true }] },
        endpoints: {
          hello: {
            method: 'hello',
            verbs: ['get'],
            path: '/hello/:name',
            data: { name: { src: 'param', required: true } },
          },
          csv: {
            method: 'csv',
            verbs: ['get'],
            path: '/csv',
            data: { response: { src: 'container', required: true } },
          },
          boom: { method: 'boom', verbs: ['get'], path: '/boom' },
        },
      })
      await server.init()
      await server.adaptor.listen(0)
      base = `http://127.0.0.1:${(server.server?.address() as AddressInfo).port}/api/t`
    })

    afterAll(async () => {
      await server.shutdown()
    })

    it('serves an endpoint with params', async () => {
      const res = await fetch(`${base}/hello/bob`)

      expect(await res.json()).toEqual({ hi: 'bob' })
    })

    it('runs a router-stage initialiser before the endpoint', async () => {
      order.length = 0
      await fetch(`${base}/hello/x`)

      expect(order).toEqual(['router-init'])
    })

    it('lets an endpoint stream its own response', async () => {
      const res = await fetch(`${base}/csv`)

      expect(res.headers.get('content-type')).toContain('text/csv')
      expect(await res.text()).toBe('a\nb\n')
    })

    it('answers an unhandled endpoint error with 500', async () => {
      const res = await fetch(`${base}/boom`)

      expect(res.status).toBe(500)
    })

    it('answers an unknown path with 404', async () => {
      expect((await fetch(`${base}/nope`)).status).toBe(404)
    })

    it('stops listening on shutdown', async () => {
      const other = new Server(
        { path: '/api', port: 0, adaptor },
        new ModelManager()
      )
      await other.init()
      await other.adaptor.listen(0)
      await other.adaptor.close()

      expect(other.server?.listening).toBe(false)
    })

    it(
      adaptor === 'express'
        ? 'still exposes app and router'
        : 'explains that app and router are Express-only',
      () => {
        if (adaptor === 'express') {
          expect(typeof server.app.use).toBe('function')
          expect(typeof server.router.use).toBe('function')
        } else {
          expect(() => server.app).toThrow(/only with the Express adaptor/)
          expect(() => server.router).toThrow(/only with the Express adaptor/)
        }
      }
    )
  }
)
