import { MiddlewareFactory } from './middleware-factory'
import { RequestDataParser } from './request-data-parser'
import { ResponseHandler } from './response-handler'
import { ErrorHandler } from './error-handler'
import {
  AclInterface,
  RequestInterface,
  ResponseInterface,
  LoggerInterface,
} from './interfaces'
import {
  ServerApiConfigEndpoint,
  ServerApiConfigEndpointResponse,
} from '../api-config'
import { ServerConfig } from '../server-config'

describe('MiddlewareFactory', () => {
  let middlewareFactory: MiddlewareFactory
  let requestDataParser: RequestDataParser
  let responseHandler: ResponseHandler
  let errorHandler: ErrorHandler
  let mockAcl: AclInterface
  let mockReq: RequestInterface
  let mockRes: ResponseInterface
  let remoteObjectContext: any

  beforeEach(() => {
    const serverConfig: Partial<ServerConfig> = {}
    requestDataParser = new RequestDataParser(serverConfig)
    responseHandler = new ResponseHandler()

    const mockLogger: LoggerInterface = {
      error: jest.fn(),
    }
    errorHandler = new ErrorHandler(mockLogger)

    mockAcl = {
      populateContext: jest.fn().mockResolvedValue(true),
      isPermitted: jest.fn().mockResolvedValue(true),
    }

    remoteObjectContext = {
      acl: mockAcl,
    }

    middlewareFactory = new MiddlewareFactory(
      requestDataParser,
      responseHandler,
      errorHandler,
      remoteObjectContext
    )

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

  describe('createMiddlewareCallback()', () => {
    it('creates a middleware function that calls the endpoint method', async () => {
      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ success: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(endpointObject.testMethod).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({ success: true })
    })

    it('passes parsed request data to the endpoint method', async () => {
      mockReq.query = { name: 'John', age: '30' }

      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ received: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {
        name: { src: 'query' },
        age: { src: 'query' },
      }

      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(endpointObject.testMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John',
          age: '30',
        })
      )
    })

    it('validates request data and returns 403 on validation failure', async () => {
      mockReq.body = {}

      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ success: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['post'],
      }

      const requestDataConfig = {
        name: { src: 'body', type: String, required: true },
      }

      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors: expect.any(Object),
        })
      )
      expect(endpointObject.testMethod).not.toHaveBeenCalled()
    })

    it('throws error when method does not exist on endpoint object', async () => {
      const endpointObject = {
        otherMethod: jest.fn(),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'nonExistentMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'nonExistentMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
    })

    it('checks ACL permissions before calling method', async () => {
      mockAcl.isPermitted = jest.fn().mockResolvedValue(false)

      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ success: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {
        ServerErrorUnauthorized: {
          http: { code: 401 },
        },
      }

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(mockAcl.isPermitted).toHaveBeenCalled()
      expect(endpointObject.testMethod).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(401)
    })

    it('injects aclContext into request data', async () => {
      mockAcl.populateContext = jest
        .fn()
        .mockImplementation(async (req, context) => {
          context.userId = '123'
          context.role = 'admin'
        })

      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ success: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(endpointObject.testMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          aclContext: expect.objectContaining({
            userId: '123',
            role: 'admin',
          }),
        })
      )
    })

    it('injects aclConditions when ACL returns conditions object', async () => {
      mockAcl.isPermitted = jest.fn().mockResolvedValue({
        userId: '123',
        organizationId: '456',
      })

      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ success: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(endpointObject.testMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          aclConditions: {
            userId: '123',
            organizationId: '456',
          },
        })
      )
    })

    it('skips automatic response when skipResponse is true', async () => {
      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ success: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
        skipResponse: true,
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(endpointObject.testMethod).toHaveBeenCalled()
      expect(mockRes.json).not.toHaveBeenCalled()
    })

    it('handles errors thrown by endpoint method', async () => {
      const testError = new Error('Method failed')

      const endpointObject = {
        testMethod: jest.fn().mockRejectedValue(testError),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['get'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {}
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
    })

    it('uses custom response configuration', async () => {
      const endpointObject = {
        testMethod: jest.fn().mockResolvedValue({ created: true }),
      }

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'testMethod',
        verbs: ['post'],
      }

      const requestDataConfig = {}
      const responseSuccess: ServerApiConfigEndpointResponse = {
        http: {
          code: 201,
        },
      }
      const responseErrorConfig = {}

      const middleware = middlewareFactory.createMiddlewareCallback(
        'test-endpoint',
        endpointConfig,
        endpointObject,
        'testMethod',
        requestDataConfig,
        responseSuccess,
        responseErrorConfig
      )

      await middleware(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(201)
      expect(mockRes.json).toHaveBeenCalledWith({ created: true })
    })
  })
})
