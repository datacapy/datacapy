import express from 'express'
import type { AddressInfo } from 'net'
import type { Server } from 'http'

import type { ServerApiConfig } from './api-config'
import ServerRemoteObject from './remote-object'

// The shape `datacapy-gen` writes for a service with a param, a header, a body field,
// a defaulted query value and a route nobody is allowed to call.
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
  },
} satisfies ServerApiConfig

describe('a generated endpoint config on a real server', () => {
  let server: Server
  let base: string
  const calls: unknown[] = []

  beforeAll(async () => {
    const service = {
      patch: async (args: unknown) => {
        calls.push(args)
        return true
      },
      secret: async () => 'hidden',
    }
    const router = express.Router()
    new ServerRemoteObject(service, {
      path: '/note',
      ...noteConfig,
    }).initRouter(router)
    const app = express()
    app.use(router)
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve())
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('passes the param, header, body field and default to the service method', async () => {
    const res = await fetch(`${base}/note/n1`, {
      method: 'PATCH',
      headers: { 'X-Project-Id': 'p1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: [{ id: 'a' }] }),
    })
    expect(res.status).toBe(200)
    expect(calls[0]).toMatchObject({
      noteId: 'n1',
      projectId: 'p1',
      changes: [{ id: 'a' }],
      page: 1,
    })
  })

  it('rejects a request missing a required header', async () => {
    const res = await fetch(`${base}/note/n1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: [] }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('denies a route whose only allow rule names a role nobody has', async () => {
    const res = await fetch(`${base}/note/secret`)
    expect(res.status).toBeGreaterThanOrEqual(401)
    expect(res.status).toBeLessThan(500)
  })
})
