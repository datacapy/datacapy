import { RequestDataParser } from './request-data-parser'
import { RequestInterface, ResponseInterface } from './interfaces'
import { ServerConfig } from '../server-config'

describe('RequestDataParser', () => {
  let parser: RequestDataParser
  let mockReq: RequestInterface
  let mockRes: ResponseInterface

  beforeEach(() => {
    const serverConfig: Partial<ServerConfig> = {
      port: 3000,
      host: 'localhost',
    }
    parser = new RequestDataParser(serverConfig)

    mockReq = {
      url: '/test',
      originalUrl: '/test',
      method: 'GET',
      query: {},
      params: {},
      body: {},
      headers: {},
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

  describe('parseRequestData()', () => {
    it('reads inherited request properties such as the Express ip getter', () => {
      class FakeRequest {
        get ip() {
          return '203.0.113.7'
        }
      }
      const req = Object.assign(new FakeRequest(), mockReq)

      const result = parser.parseRequestData(
        { ip: { src: 'request' } },
        req as unknown as RequestInterface,
        mockRes
      )

      expect(result.ip).toBe('203.0.113.7')
    })

    it('parses query parameters by default', () => {
      mockReq.query = { name: 'John', age: '30' }

      const requestDataConfig = {
        name: {},
        age: {},
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.name).toBe('John')
      expect(result.age).toBe('30')
    })

    it('parses body parameters when src is body', () => {
      mockReq.body = { username: 'john_doe', email: 'john@example.com' }

      const requestDataConfig = {
        username: { src: 'body' },
        email: { src: 'body' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.username).toBe('john_doe')
      expect(result.email).toBe('john@example.com')
    })

    it('parses route parameters when src is param', () => {
      mockReq.params = { id: '123', slug: 'test-post' }

      const requestDataConfig = {
        id: { src: 'param' },
        slug: { src: 'param' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.id).toBe('123')
      expect(result.slug).toBe('test-post')
    })

    it('parses header values when src is header', () => {
      mockReq.get = jest.fn((header) => {
        if (header === 'authorization') return 'Bearer token123'
        if (header === 'content-type') return 'application/json'
        return undefined
      })

      const requestDataConfig = {
        auth: { src: 'header', srcPath: 'authorization' },
        contentType: { src: 'header', srcPath: 'content-type' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.auth).toBe('Bearer token123')
      expect(result.contentType).toBe('application/json')
    })

    it('uses srcPath to access nested properties', () => {
      mockReq.body = {
        user: {
          profile: {
            name: 'John Doe',
          },
        },
      }

      const requestDataConfig = {
        userName: { src: 'body', srcPath: 'user.profile.name' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.userName).toBe('John Doe')
    })

    it('accesses request object when src is request', () => {
      const requestDataConfig = {
        fullRequest: { src: 'container', srcPath: 'request' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.fullRequest).toBe(mockReq)
    })

    it('accesses response object when src is response', () => {
      const requestDataConfig = {
        fullResponse: { src: 'container', srcPath: 'response' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.fullResponse).toBe(mockRes)
    })

    it('accesses config when src is config', () => {
      const serverConfig: Partial<ServerConfig> = {
        port: 8080,
        host: 'example.com',
      }
      parser = new RequestDataParser(serverConfig)

      const requestDataConfig = {
        serverPort: { src: 'config', srcPath: 'port' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.serverPort).toBe(8080)
    })

    it('handles missing values gracefully', () => {
      mockReq.query = {}

      const requestDataConfig = {
        missingField: { src: 'query' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.missingField).toBeUndefined()
    })

    it('handles aclContext when available', () => {
      mockReq.aclContext = { userId: '123', role: 'admin' }

      const requestDataConfig = {
        aclData: { src: 'container', srcPath: 'aclContext' },
      }

      const result = parser.parseRequestData(
        requestDataConfig,
        mockReq,
        mockRes
      )

      expect(result.aclData).toEqual({ userId: '123', role: 'admin' })
    })
  })

  describe('parseValidationSpec()', () => {
    it('creates validation spec with type', () => {
      const requestDataConfig = {
        name: { type: String },
        age: { type: Number },
      }

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result.name.$type).toBe(String)
      expect(result.age.$type).toBe(Number)
    })

    it('creates validation spec with required constraint', () => {
      const requestDataConfig = {
        name: { type: String, required: true },
        email: { type: String, required: false },
      }

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result.name.$validate.required).toBe(true)
      expect(result.email.$validate.required).toBe(false)
    })

    it('creates validation spec with notNull constraint', () => {
      const requestDataConfig = {
        name: { type: String, notNull: true },
      }

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result.name.$validate.notNull).toBe(true)
    })

    it('creates validation spec with notEmpty constraint', () => {
      const requestDataConfig = {
        name: { type: String, notEmpty: true },
      }

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result.name.$validate.notEmpty).toBe(true)
    })

    it('creates validation spec with defaultValue filter', () => {
      const requestDataConfig = {
        role: { type: String, defaultValue: 'user' },
      }

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result.role.$filter.defaultValue).toBe('user')
    })

    it('handles multiple constraints on a single field', () => {
      const requestDataConfig = {
        email: {
          type: String,
          required: true,
          notNull: true,
          notEmpty: true,
        },
      }

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result.email.$type).toBe(String)
      expect(result.email.$validate.required).toBe(true)
      expect(result.email.$validate.notNull).toBe(true)
      expect(result.email.$validate.notEmpty).toBe(true)
    })

    it('handles empty request data config', () => {
      const requestDataConfig = {}

      const result = parser.parseValidationSpec(requestDataConfig)

      expect(result).toEqual({})
    })
  })

  describe('validateRequestData()', () => {
    it('validates data successfully when all constraints are met', async () => {
      const requestData = {
        name: 'John',
        age: 30,
      }

      const validationSpec = {
        name: {
          $type: String,
          $validate: { required: true },
          $filter: {},
        },
        age: {
          $type: Number,
          $validate: {},
          $filter: {},
        },
      }

      const result = await parser.validateRequestData(
        requestData,
        validationSpec
      )

      expect(result.isValid).toBe(true)
    })

    it('returns validation errors when required field is missing', async () => {
      const requestData = {
        age: 30,
      }

      const validationSpec = {
        name: {
          $type: String,
          $validate: { required: true },
          $filter: {},
        },
        age: {
          $type: Number,
          $validate: {},
          $filter: {},
        },
      }

      const result = await parser.validateRequestData(
        requestData,
        validationSpec
      )

      expect(result.isValid).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('validates empty spec successfully', async () => {
      const requestData = {}
      const validationSpec = {}

      const result = await parser.validateRequestData(
        requestData,
        validationSpec
      )

      expect(result.isValid).toBe(true)
    })
  })
})
