// cspell:ignore dont
import { ModelManager } from '@datacapy/om'

import Server from './server'

function notFound(module: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(
    `Cannot find module '${module}'`
  )
  error.code = 'MODULE_NOT_FOUND'
  return error
}

describe.each([
  {
    adaptor: 'hono',
    path: './adaptor/hono',
    peer: 'hono',
    hint: "adaptor 'hono' needs the optional peer 'hono'. Install it: pnpm add hono @hono/node-server",
  },
  {
    adaptor: 'hono',
    path: './adaptor/hono',
    peer: '@hono/node-server',
    hint: "adaptor 'hono' needs the optional peer 'hono'. Install it: pnpm add hono @hono/node-server",
  },
  {
    adaptor: 'express',
    path: './adaptor/express',
    peer: 'express',
    hint: "adaptor 'express' needs the optional peer 'express'. Install it: pnpm add express",
  },
] as const)('loading the $adaptor adaptor without $peer', (c) => {
  afterEach(() => {
    jest.dontMock(c.path)
  })

  const build = () =>
    new Server(
      { path: '/api', port: 0, adaptor: c.adaptor },
      new ModelManager()
    )

  it('throws an install hint with the original error as cause', () => {
    const original = notFound(c.peer)
    jest.doMock(c.path, () => {
      throw original
    })
    let thrown: Error | undefined
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const IsolatedServer = require('./server').default as typeof Server
      try {
        new IsolatedServer(
          { path: '/api', port: 0, adaptor: c.adaptor },
          new ModelManager()
        )
      } catch (error) {
        thrown = error as Error
      }
    })
    expect(thrown?.message).toBe(c.hint)
    expect((thrown as Error & { cause?: unknown }).cause).toBe(original)
  })

  it('leaves an unrelated failure unchanged', () => {
    const original = new Error('boom')
    const other = notFound('some-other-module')
    for (const failure of [original, other]) {
      jest.doMock(c.path, () => {
        throw failure
      })
      let thrown: unknown
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const IsolatedServer = require('./server').default as typeof Server
        try {
          new IsolatedServer(
            { path: '/api', port: 0, adaptor: c.adaptor },
            new ModelManager()
          )
        } catch (error) {
          thrown = error
        }
      })
      expect(thrown).toBe(failure)
    }
  })

  it('still builds when the peer is present', () => {
    jest.dontMock(c.path)
    expect(build).not.toThrow()
  })
})
