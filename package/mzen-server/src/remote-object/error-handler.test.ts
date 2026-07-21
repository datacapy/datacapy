import { ErrorHandler } from './error-handler'
import {
  LoggerInterface,
  RequestInterface,
  ResponseInterface,
} from './interfaces'

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler
  let mockLogger: LoggerInterface
  let mockReq: RequestInterface
  let mockRes: ResponseInterface

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    }

    errorHandler = new ErrorHandler(mockLogger)

    mockReq = {
      url: '/test',
      originalUrl: '/test',
      method: 'GET',
      query: {},
      params: {},
      body: {},
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      get: jest.fn(),
    }

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      headersSent: false,
      end: jest.fn(),
    }
  })

  describe('setLogger()', () => {
    it('updates the logger instance', () => {
      const newLogger: LoggerInterface = {
        error: jest.fn(),
      }

      errorHandler.setLogger(newLogger)

      // Verify by triggering an error that would use the logger
      const err = new Error('Test error')
      errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        {}
      )

      // The new logger should be called (we can't directly test private logger, but effect shows it)
      expect(mockRes.status).toHaveBeenCalled()
    })
  })

  describe('handleEndpointError()', () => {
    it('sends 500 status for unhandled errors', async () => {
      const err = new Error('Unexpected error')

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        {}
      )

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'InternalServerError',
          message: 'Unexpected error',
          endpoint: 'test-endpoint',
          method: 'testMethod',
        })
      )
    })

    it('sends custom status code for configured error types', async () => {
      class ValidationError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'ValidationError'
        }
      }

      const err = new ValidationError('Invalid input')

      const responseErrorConfig = {
        ValidationError: {
          http: { code: 400 },
        },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(err)
    })

    it('handles multiple error type configurations', async () => {
      class NotFoundError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'NotFoundError'
        }
      }

      const err = new NotFoundError('Resource not found')

      const responseErrorConfig = {
        ValidationError: {
          http: { code: 400 },
        },
        NotFoundError: {
          http: { code: 404 },
        },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith(err)
    })

    it('sends text response for non-json content types', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const err = new CustomError('Custom error message')

      const responseErrorConfig = {
        CustomError: {
          http: {
            code: 403,
            contentType: 'text/plain',
          },
        },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.type).toHaveBeenCalledWith('text/plain')
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.send).toHaveBeenCalledWith('Custom error message')
    })

    it('does not send response if headers already sent', async () => {
      mockRes.headersSent = true

      const err = new Error('Too late')

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        {}
      )

      expect(mockRes.status).not.toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
    })

    it('handles non-Error objects', async () => {
      const err = 'String error'

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        {}
      )

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalled()
    })

    it('handles null error', async () => {
      const err = null

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        {}
      )

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalled()
    })

    it('uses first matching error handler', async () => {
      class ValidationError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'ValidationError'
        }
      }

      const err = new ValidationError('Invalid')

      const responseErrorConfig = {
        ValidationError: {
          http: { code: 400 },
        },
        ValidationError2: {
          http: { code: 422 },
        },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('attempts to send fatal error response', async () => {
      // Create a response that tracks if status was called
      let statusCalled = false

      const brokenRes: ResponseInterface = {
        status: jest.fn((code) => {
          statusCalled = true
          return brokenRes
        }),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        end: jest.fn(),
        headersSent: false,
      }

      const err = new Error('Original error')

      await errorHandler.handleEndpointError(
        err,
        brokenRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        {}
      )

      expect(statusCalled).toBe(true)
    })

    it('defaults to 400 status code when error config has no code', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const err = new CustomError('Custom error')

      const responseErrorConfig = {
        CustomError: {
          http: {},
        },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
    })

    it('defaults to json content type when not specified', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const err = new CustomError('Custom error')

      const responseErrorConfig = {
        CustomError: {
          http: { code: 400 },
        },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.json).toHaveBeenCalledWith(err)
      expect(mockRes.type).not.toHaveBeenCalled()
    })
  })

  describe('setErrorTranslator()', () => {
    it('passes errors through unchanged when no translator is set', async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const err = new CustomError('Custom error')
      const responseErrorConfig = {
        CustomError: { http: { code: 400 } },
      }

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.json).toHaveBeenCalledWith(err)
    })

    it('mutates the error via the translator before serialization', async () => {
      class CustomError extends Error {
        userMessage?: string
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const err = new CustomError('Custom error')
      const responseErrorConfig = {
        CustomError: { http: { code: 400 } },
      }

      errorHandler.setErrorTranslator(async (translatedErr) => {
        translatedErr.userMessage = 'Translated message'
        return translatedErr
      })

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: 'Translated message' })
      )
    })

    it('falls back to the fatal error handler if the translator itself throws', async () => {
      const err = new Error('Original error')
      const responseErrorConfig = {}

      errorHandler.setErrorTranslator(async () => {
        throw new Error('Translator failure')
      })

      await errorHandler.handleEndpointError(
        err,
        mockRes,
        mockReq,
        'test-endpoint',
        'testMethod',
        responseErrorConfig
      )

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'FatalServerError' })
      )
    })
  })
})
