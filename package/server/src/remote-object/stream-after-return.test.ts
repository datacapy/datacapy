import express from 'express'
import type { Server } from 'http'
import type { AddressInfo } from 'net'

import { MiddlewareFactory } from './middleware-factory'
import { RequestDataParser } from './request-data-parser'
import { ResponseHandler } from './response-handler'
import { ErrorHandler } from './error-handler'
import type { RequestInterface, ResponseInterface } from './interfaces'
import type { ServerConfig } from '../server-config'

/**
 * Pins what a streaming endpoint sees on real Express: the method writes the
 * body itself through the `response` container and returns nothing.
 */
describe('endpoint that answers through the response container', () => {
  let server: Server
  let successSpy: jest.SpyInstance
  const logger = { error: jest.fn() }

  beforeEach((done) => {
    const responseHandler = new ResponseHandler()
    successSpy = jest.spyOn(responseHandler, 'sendSuccessResponse')
    const factory = new MiddlewareFactory(
      new RequestDataParser({} as ServerConfig),
      responseHandler,
      new ErrorHandler(logger),
      {
        acl: {
          populateContext: async () => true,
          isPermitted: async () => true,
        },
      }
    )
    const endpoint = {
      export: async ({ response }: { response: ResponseInterface }) => {
        response.type('text/csv')
        response.send('a,b\n')
        response.end()
      },
    }
    const app = express()
    app.get(
      '/export',
      factory.createMiddlewareCallback(
        'export',
        { method: 'export' },
        endpoint,
        'export',
        { response: { src: 'container', required: true } },
        {},
        {}
      ) as (req: RequestInterface, res: ResponseInterface) => Promise<void>
    )
    server = app.listen(0, done)
  })

  afterEach((done) => {
    server.close(done)
  })

  it('delivers the streamed body once, with no error and no second write', async () => {
    const { port } = server.address() as AddressInfo
    const res = await fetch(`http://127.0.0.1:${port}/export`)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(await res.text()).toBe('a,b\n')
    expect(logger.error).not.toHaveBeenCalled()
    expect(successSpy).not.toHaveBeenCalled()
  })
})
