import express from 'express'
import { ExpressAppManager } from './express-app-manager'
import { ServerConfig } from '../server-config'

describe('ExpressAppManager', () => {
  let manager: ExpressAppManager
  let mockLogger: any
  let config: ServerConfig

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    config = {
      path: '/api',
      port: 3838,
    }

    manager = new ExpressAppManager(config, mockLogger)
  })

  describe('constructor()', () => {
    it('creates Express application instance', () => {
      const app = manager.getApp()

      expect(app).toBeDefined()
      expect(typeof app).toBe('function')
    })

    it('creates Express router instance', () => {
      const router = manager.getRouter()

      expect(router).toBeDefined()
      expect(typeof router).toBe('function')
    })
  })

  describe('getApp()', () => {
    it('returns the Express application instance', () => {
      const app = manager.getApp()

      expect(app).toBeDefined()
      expect(typeof app.use).toBe('function')
      expect(typeof app.listen).toBe('function')
    })

    it('returns the same app instance on multiple calls', () => {
      const app1 = manager.getApp()
      const app2 = manager.getApp()

      expect(app1).toBe(app2)
    })
  })

  describe('getRouter()', () => {
    it('returns the Express router instance', () => {
      const router = manager.getRouter()

      expect(router).toBeDefined()
      expect(typeof router.use).toBe('function')
      expect(typeof router.get).toBe('function')
      expect(typeof router.post).toBe('function')
    })

    it('returns the same router instance on multiple calls', () => {
      const router1 = manager.getRouter()
      const router2 = manager.getRouter()

      expect(router1).toBe(router2)
    })
  })

  describe('mountRouter()', () => {
    it('mounts router at specified path', () => {
      const app = manager.getApp()
      const useSpy = jest.spyOn(app, 'use')

      manager.mountRouter('/api')

      expect(useSpy).toHaveBeenCalled()
    })

    it('can mount router at different paths', () => {
      const app = manager.getApp()
      const useSpy = jest.spyOn(app, 'use')

      manager.mountRouter('/v1/api')

      expect(useSpy).toHaveBeenCalledWith('/v1/api', expect.any(Function))
    })
  })

  describe('setupErrorHandler()', () => {
    it('sets up error handling middleware on app', () => {
      const app = manager.getApp()
      const useSpy = jest.spyOn(app, 'use')

      const newLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }

      manager.setupErrorHandler(newLogger)

      expect(useSpy).toHaveBeenCalled()
      const errorHandler = useSpy.mock.calls[0][0] as any
      expect(typeof errorHandler).toBe('function')
      expect(errorHandler.length).toBe(4) // Error handlers have 4 params
    })

    it('error handler logs error and sends 500 response', () => {
      const app = manager.getApp()
      const useSpy = jest.spyOn(app, 'use')

      const newLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }

      manager.setupErrorHandler(newLogger)

      const errorHandler = useSpy.mock.calls[0][0] as any

      const mockError = new Error('Test error')
      const mockReq = {}
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      const mockNext = jest.fn()

      errorHandler(mockError, mockReq, mockRes, mockNext)

      expect(newLogger.error).toHaveBeenCalledWith({
        err: mockError,
        req: mockReq,
        res: mockRes,
      })
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.send).toHaveBeenCalledWith('Something broke!')
      expect(mockNext).toHaveBeenCalled()
    })

    it('updates logger reference when called', () => {
      const app = manager.getApp()
      const useSpy = jest.spyOn(app, 'use')

      const newLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }

      manager.setupErrorHandler(newLogger)

      const errorHandler = useSpy.mock.calls[0][0] as any

      const mockError = new Error('Test')
      const mockReq = {}
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      const mockNext = jest.fn()

      errorHandler(mockError, mockReq, mockRes, mockNext)

      expect(newLogger.error).toHaveBeenCalled()
    })
  })
})
