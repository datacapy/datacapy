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
    it('initializes with null server', () => {
      const server = manager.getServer()

      expect(server).toBeNull()
    })

    it('stores app reference', () => {
      expect(manager).toBeDefined()
    })

    it('stores config reference', () => {
      expect(manager).toBeDefined()
    })

    it('stores logger reference', () => {
      expect(manager).toBeDefined()
    })

    it('stores onShutdown callback', () => {
      expect(manager).toBeDefined()
    })
  })

  describe('start()', () => {
    it('starts the HTTP server on configured port', async () => {
      const listenSpy = jest
        .spyOn(app, 'listen')
        .mockImplementation((port, callback: any) => {
          callback()
          return {} as any
        })

      await manager.start()

      expect(listenSpy).toHaveBeenCalledWith(config.port, expect.any(Function))
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Listening on port ' + config.port
      )
    })

    it('sets up SIGINT handler', async () => {
      jest.spyOn(app, 'listen').mockImplementation((port, callback: any) => {
        callback()
        return {} as any
      })

      const onSpy = jest.spyOn(process, 'on')

      await manager.start()

      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })

    it('stores server instance after start', async () => {
      const mockServer = {} as any
      jest.spyOn(app, 'listen').mockImplementation((port, callback: any) => {
        callback()
        return mockServer
      })

      await manager.start()
      const server = manager.getServer()

      expect(server).toBe(mockServer)
    })
  })

  describe('shutdown()', () => {
    it('returns undefined when server is null', async () => {
      const result = await manager.shutdown()

      expect(result).toBeUndefined()
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down')
    })

    it('closes server when server exists', async () => {
      const mockClose = jest.fn()
      const mockServer = {
        close: mockClose,
      } as any

      jest.spyOn(app, 'listen').mockImplementation((port, callback: any) => {
        callback()
        return mockServer
      })

      await manager.start()
      await manager.shutdown()

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down')
      expect(mockClose).toHaveBeenCalled()
    })

    it('logs shutdown message', async () => {
      await manager.shutdown()

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down')
    })
  })

  describe('getServer()', () => {
    it('returns null before server is started', () => {
      const server = manager.getServer()

      expect(server).toBeNull()
    })

    it('returns server instance after start', async () => {
      const mockServer = {} as any
      jest.spyOn(app, 'listen').mockImplementation((port, callback: any) => {
        callback()
        return mockServer
      })

      await manager.start()
      const server = manager.getServer()

      expect(server).toBe(mockServer)
    })
  })

  describe('SIGINT handler', () => {
    it('calls onShutdown when SIGINT received', async () => {
      jest.spyOn(app, 'listen').mockImplementation((port, callback: any) => {
        callback()
        return {} as any
      })

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
