import express from 'express'

import { runAdaptorConformance } from '../../test-utils/adaptor-conformance'
import { ExpressAdaptor } from './express-adaptor'

const logger = { error: jest.fn(), info: jest.fn() }

function create(): ExpressAdaptor {
  return new ExpressAdaptor({ path: '/api', port: 0 }, logger, async () => {})
}

runAdaptorConformance('Express', create)

describe('ExpressAdaptor specifics', () => {
  it('exposes the Express app and router for code that predates the adaptor', () => {
    const adaptor = create()

    expect(typeof adaptor.native.use).toBe('function')
    expect(adaptor.native).toBeInstanceOf(Object)
    expect(typeof adaptor.getRouter().use).toBe('function')
    expect(express.Router).toBeDefined()
  })

  it('rejects listen when the port is taken', async () => {
    const first = create()
    await first.listen(0)
    const { port } = first.server.address() as { port: number }
    const second = create()

    await expect(second.listen(port)).rejects.toMatchObject({
      code: 'EADDRINUSE',
    })

    await first.close()
  })
})
