import net from 'net'
import { AddressInfo } from 'net'
import express from 'express'
import { HttpServerManager } from './http-server-manager'
import { ServerConfig } from '../server-config'

describe('HttpServerManager', () => {
  let app: express.Application
  let config: ServerConfig
  let mockLogger: any
  let mockOnShutdown: jest.Mock
  let manager: HttpServerManager

  beforeEach(() => {
    app = express()
    config = {
      path: '/api',
      port: 3838,
    }
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }
    mockOnShutdown = jest.fn().mockResolvedValue(undefined)
    manager = new HttpServerManager(app, config, mockLogger, mockOnShutdown)
  })

  afterEach(() => {
    // Clean up any listeners
    process.removeAllListeners('SIGINT')
  })

  describe('constructor()', () => {
    it('creates the http server up front', () => {
      expect(manager.getServer()).toBeDefined()
      expect(manager.getServer().listening).toBe(false)
    })
  })

  describe('start()', () => {
    it('listens on the configured port and logs', async () => {
      const server = manager.getServer()
      const listenSpy = jest.spyOn(server, 'listen').mockImplementation(((
        port: number,
        callback: () => void
      ) => {
        callback()
        return server
      }) as any)

      await manager.start()

      expect(listenSpy).toHaveBeenCalledWith(config.port, expect.any(Function))
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Listening on port ' + config.port
      )
    })

    it('sets up SIGINT handler', async () => {
      const server = manager.getServer()
      jest.spyOn(server, 'listen').mockReturnValue(server)
      const onSpy = jest.spyOn(process, 'on')

      await manager.start()

      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })
  })

  describe('shutdown()', () => {
    it('resolves when the server never started', async () => {
      await expect(manager.shutdown()).resolves.toBeUndefined()
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down')
    })

    it('resolves with an idle open connection', async () => {
      const server = manager.getServer()
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const { port } = server.address() as AddressInfo
      const client = net.connect(port, '127.0.0.1')
      client.on('error', () => undefined)
      await new Promise<void>((resolve) => client.on('connect', resolve))

      await manager.shutdown()

      expect(server.listening).toBe(false)
      client.destroy()
    })

    it('does not throw when the server was already closed', async () => {
      const server = manager.getServer()
      await new Promise<void>((resolve) => server.listen(0, resolve))
      await new Promise<void>((resolve) => server.close(() => resolve()))

      await expect(manager.shutdown()).resolves.toBeUndefined()
    })
  })

  describe('getServer()', () => {
    it('returns the same server instance each time', () => {
      expect(manager.getServer()).toBe(manager.getServer())
    })
  })

  describe('SIGINT handler', () => {
    it('calls onShutdown when SIGINT received', async () => {
      jest
        .spyOn(manager.getServer(), 'listen')
        .mockReturnValue(manager.getServer())

      await manager.start()

      // Get the SIGINT handler
      const sigintHandler = process.listeners('SIGINT')[0] as Function

      // Mock process.exit to prevent it from actually exiting
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any)
      jest.useFakeTimers()

      // Call the handler and wait for promise
      const shutdownPromise = sigintHandler()
      await shutdownPromise

      expect(mockOnShutdown).toHaveBeenCalled()

      // Fast-forward timers to trigger the setTimeout
      jest.runAllTimers()

      expect(exitSpy).toHaveBeenCalledWith(0)

      jest.useRealTimers()
      exitSpy.mockRestore()
    })
  })
})
