import { ResponseHandler } from './response-handler'
import { ResponseInterface } from './interfaces'
import { ServerApiConfigEndpointResponse } from '../api-config'

describe('ResponseHandler', () => {
  let responseHandler: ResponseHandler

  beforeEach(() => {
    responseHandler = new ResponseHandler()
  })

  describe('sendSuccessResponse()', () => {
    it('sends JSON response with default 200 status code', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = { message: 'success' }
      const responseSuccess: ServerApiConfigEndpointResponse = {}

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(response)
    })

    it('sends JSON response with custom status code', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = { message: 'created' }
      const responseSuccess: ServerApiConfigEndpointResponse = {
        http: {
          code: 201,
        },
      }

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.status).toHaveBeenCalledWith(201)
      expect(mockRes.json).toHaveBeenCalledWith(response)
    })

    it('sends plain text response when contentType is not json', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = 'plain text response'
      const responseSuccess: ServerApiConfigEndpointResponse = {
        http: {
          contentType: 'text/plain',
        },
      }

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.type).toHaveBeenCalledWith('text/plain')
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.send).toHaveBeenCalledWith(response)
      expect(mockRes.json).not.toHaveBeenCalled()
    })

    it('sends XML response with custom status code', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = '<root><message>success</message></root>'
      const responseSuccess: ServerApiConfigEndpointResponse = {
        http: {
          code: 202,
          contentType: 'application/xml',
        },
      }

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.type).toHaveBeenCalledWith('application/xml')
      expect(mockRes.status).toHaveBeenCalledWith(202)
      expect(mockRes.send).toHaveBeenCalledWith(response)
    })

    it('handles empty response config', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = { data: 'test' }
      const responseSuccess: ServerApiConfigEndpointResponse = {}

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(response)
    })

    it('handles null response body', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = null
      const responseSuccess: ServerApiConfigEndpointResponse = {}

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(null)
    })

    it('handles array response', () => {
      const mockRes: ResponseInterface = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        headersSent: false,
        end: jest.fn(),
      }

      const response = [{ id: 1 }, { id: 2 }]
      const responseSuccess: ServerApiConfigEndpointResponse = {}

      responseHandler.sendSuccessResponse(mockRes, response, responseSuccess)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith(response)
    })
  })
})
