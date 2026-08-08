import { EndpointRegistrar } from './endpoint-registrar'
import { ServerApiConfig } from '../api-config'
import { ServerRemoteObject } from '../remote-object'
import express from 'express'

// Mock the dependencies
jest.mock('../acl')
jest.mock('../remote-object')

const MockServerRemoteObject = ServerRemoteObject as unknown as jest.Mock

// Returns the endpoint names actually passed into ServerRemoteObject's constructor
// across all registered services - i.e. what actually got registered.
function getRegisteredEndpointNames(): string[] {
  return MockServerRemoteObject.mock.calls.flatMap(([, options]) =>
    Object.keys(options.endpoints)
  )
}

describe('EndpointRegistrar', () => {
  let registrar: EndpointRegistrar
  let mockConfigurationManager: any
  let mockExpressAppManager: any
  let mockAclRegistry: any
  let mockApiConfigRegistry: any
  let mockLogger: any
  let mockModelManager: any
  let mockRouter: express.Router

  beforeEach(() => {
    MockServerRemoteObject.mockClear()
    mockRouter = express.Router()

    mockModelManager = {
      repos: {},
      services: {},
    }

    mockConfigurationManager = {
      getModelManager: jest.fn().mockReturnValue(mockModelManager),
      getConfig: jest.fn().mockReturnValue({
        path: '/api',
        port: 3838,
      }),
    }

    mockExpressAppManager = {
      getRouter: jest.fn().mockReturnValue(mockRouter),
    }

    mockAclRegistry = {
      getRoleAssessors: jest.fn().mockReturnValue({}),
    }

    mockApiConfigRegistry = {
      getApiConfigs: jest.fn().mockReturnValue([]),
    }

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    registrar = new EndpointRegistrar(
      mockConfigurationManager,
      mockExpressAppManager,
      mockAclRegistry,
      mockApiConfigRegistry,
      mockLogger
    )
  })

  describe('constructor()', () => {
    it('initializes with all dependencies', () => {
      expect(registrar).toBeDefined()
    })
  })

  describe('registerEndpoints()', () => {
    it('does nothing when no api configs exist', () => {
      mockApiConfigRegistry.getApiConfigs.mockReturnValue(undefined)

      registrar.registerEndpoints()

      expect(mockApiConfigRegistry.getApiConfigs).toHaveBeenCalled()
    })

    it('does nothing when api configs array is empty', () => {
      mockApiConfigRegistry.getApiConfigs.mockReturnValue([])

      registrar.registerEndpoints()

      expect(mockApiConfigRegistry.getApiConfigs).toHaveBeenCalled()
    })

    it('processes each api config', () => {
      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
        {
          service: 'PostService',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockModelManager.services = {
        UserService: {},
        PostService: {},
      }

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockApiConfigRegistry.getApiConfigs).toHaveBeenCalled()
      expect(mockConfigurationManager.getModelManager).toHaveBeenCalled()
    })

    it('skips configs with enable set to false', () => {
      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: false,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(MockServerRemoteObject).not.toHaveBeenCalled()
    })

    it('registers configs with enable set to true', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(getRegisteredEndpointNames()).toEqual(['list'])
    })

    it('registers configs with no enable flag specified', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(getRegisteredEndpointNames()).toEqual(['list'])
    })

    it('removes an individual endpoint with enable set to false', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          endpoints: {
            list: { groups: [] },
            create: { groups: [], enable: false },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(getRegisteredEndpointNames()).toEqual(['list'])
    })

    it('skips configs with no endpoints', () => {
      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          endpoints: {},
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockApiConfigRegistry.getApiConfigs).toHaveBeenCalled()
    })

    it('uses service from model manager when service name provided', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockConfigurationManager.getModelManager).toHaveBeenCalled()
    })

    it('uses repo from model manager when repo name provided', () => {
      const mockRepo = { name: 'UserRepo' }
      mockModelManager.repos = {
        UserRepo: mockRepo,
      }

      const configs: ServerApiConfig[] = [
        {
          repo: 'UserRepo',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockConfigurationManager.getModelManager).toHaveBeenCalled()
    })

    it('uses provided object when object property exists', () => {
      const mockObject = { name: 'CustomObject' }

      const configs: ServerApiConfig[] = [
        {
          object: mockObject,
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockConfigurationManager.getModelManager).toHaveBeenCalled()
    })

    it('uses custom path when provided', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          path: '/custom-path',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockConfigurationManager.getModelManager).toHaveBeenCalled()
    })

    it('removes disabled endpoints', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          disable: {
            create: true,
          },
          endpoints: {
            list: { groups: [] },
            create: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(getRegisteredEndpointNames()).toEqual(['list'])
    })

    it('removes endpoints in disabled groups', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          disableGroup: {
            admin: true,
          },
          endpoints: {
            list: { groups: [] },
            adminAction: { groups: ['admin'] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(getRegisteredEndpointNames()).toEqual(['list'])
    })

    it('gets role assessors from registry', () => {
      const mockService = { name: 'UserService' }
      mockModelManager.services = {
        UserService: mockService,
      }

      const mockRoleAssessors = {
        admin: { role: 'admin' },
      }
      mockAclRegistry.getRoleAssessors.mockReturnValue(mockRoleAssessors)

      const configs: ServerApiConfig[] = [
        {
          service: 'UserService',
          enable: true,
          endpoints: {
            list: { groups: [] },
          },
        },
      ]

      mockApiConfigRegistry.getApiConfigs.mockReturnValue(configs)

      registrar.registerEndpoints()

      expect(mockAclRegistry.getRoleAssessors).toHaveBeenCalled()
    })
  })
})
