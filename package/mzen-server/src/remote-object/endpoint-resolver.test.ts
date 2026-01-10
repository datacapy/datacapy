import { EndpointResolver } from './endpoint-resolver'
import { ModelManagerInterface } from './interfaces'
import { ServerApiConfigEndpoint } from '../api-config'

describe('EndpointResolver', () => {
  describe('resolveEndpointObject()', () => {
    it('returns direct object when endpoint.object is specified', () => {
      const defaultObject = { default: 'method' }
      const endpointObject = { custom: 'method' }
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        object: endpointObject,
        method: 'custom',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointObject(endpointConfig)

      expect(result).toBe(endpointObject)
    })

    it('returns service from model manager when endpoint.service is specified', () => {
      const defaultObject = { default: 'method' }
      const serviceObject = { serviceMethod: 'test' }
      const modelManager: ModelManagerInterface = {
        services: {
          userService: serviceObject,
        },
        repos: {},
      }

      const resolver = new EndpointResolver(defaultObject, modelManager)

      const endpointConfig: ServerApiConfigEndpoint = {
        service: 'userService',
        method: 'serviceMethod',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointObject(endpointConfig)

      expect(result).toBe(serviceObject)
    })

    it('returns repo from model manager when endpoint.repo is specified', () => {
      const defaultObject = { default: 'method' }
      const repoObject = { repoMethod: 'test' }
      const modelManager: ModelManagerInterface = {
        services: {},
        repos: {
          userRepo: repoObject,
        },
      }

      const resolver = new EndpointResolver(defaultObject, modelManager)

      const endpointConfig: ServerApiConfigEndpoint = {
        repo: 'userRepo',
        method: 'repoMethod',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointObject(endpointConfig)

      expect(result).toBe(repoObject)
    })

    it('returns default object when no specific object/service/repo specified', () => {
      const defaultObject = { default: 'method' }
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'default',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointObject(endpointConfig)

      expect(result).toBe(defaultObject)
    })

    it('throws error when service is not found in model manager', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const defaultObject = { default: 'method' }
      const modelManager: ModelManagerInterface = {
        services: {},
        repos: {},
      }

      const resolver = new EndpointResolver(defaultObject, modelManager)

      const endpointConfig: ServerApiConfigEndpoint = {
        service: 'nonExistentService',
        method: 'someMethod',
        verbs: ['get'],
      }

      expect(() => {
        resolver.resolveEndpointObject(endpointConfig)
      }).toThrow(
        'Service "nonExistentService" not found in modelManager.services'
      )

      consoleErrorSpy.mockRestore()
    })

    it('throws error when repo is not found in model manager', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const defaultObject = { default: 'method' }
      const modelManager: ModelManagerInterface = {
        services: {},
        repos: {},
      }

      const resolver = new EndpointResolver(defaultObject, modelManager)

      const endpointConfig: ServerApiConfigEndpoint = {
        repo: 'nonExistentRepo',
        method: 'someMethod',
        verbs: ['get'],
      }

      expect(() => {
        resolver.resolveEndpointObject(endpointConfig)
      }).toThrow('Repo "nonExistentRepo" not found in modelManager.repos')

      consoleErrorSpy.mockRestore()
    })

    it('throws error when service specified but no model manager provided', () => {
      const defaultObject = { default: 'method' }
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        service: 'userService',
        method: 'someMethod',
        verbs: ['get'],
      }

      expect(() => {
        resolver.resolveEndpointObject(endpointConfig)
      }).toThrow(
        'Cannot resolve service "userService" - modelManager not provided to ServerRemoteObject'
      )
    })

    it('throws error when repo specified but no model manager provided', () => {
      const defaultObject = { default: 'method' }
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        repo: 'userRepo',
        method: 'someMethod',
        verbs: ['get'],
      }

      expect(() => {
        resolver.resolveEndpointObject(endpointConfig)
      }).toThrow(
        'Cannot resolve repo "userRepo" - modelManager not provided to ServerRemoteObject'
      )
    })

    it('prioritizes direct object over service', () => {
      const defaultObject = { default: 'method' }
      const endpointObject = { custom: 'method' }
      const serviceObject = { serviceMethod: 'test' }
      const modelManager: ModelManagerInterface = {
        services: {
          userService: serviceObject,
        },
        repos: {},
      }

      const resolver = new EndpointResolver(defaultObject, modelManager)

      const endpointConfig: ServerApiConfigEndpoint = {
        object: endpointObject,
        service: 'userService',
        method: 'custom',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointObject(endpointConfig)

      expect(result).toBe(endpointObject)
    })
  })

  describe('resolveEndpointPath()', () => {
    it('returns explicit path when provided', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        path: '/custom/path',
        method: 'myMethod',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'myMethod')

      expect(result).toBe('/custom/path')
    })

    it('returns kebab-case service name when service is specified without path', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        service: 'userService',
        method: 'myMethod',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'myMethod')

      expect(result).toBe('/user-service')
    })

    it('returns kebab-case repo name when repo is specified without path', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        repo: 'userRepo',
        method: 'myMethod',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'myMethod')

      expect(result).toBe('/user-repo')
    })

    it('returns method name when no path, service, or repo specified', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        method: 'myMethod',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'myMethod')

      expect(result).toBe('myMethod')
    })

    it('converts camelCase to kebab-case for service names', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        service: 'surveyParticipantService',
        method: 'getAll',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'getAll')

      expect(result).toBe('/survey-participant-service')
    })

    it('converts camelCase to kebab-case for repo names', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        repo: 'surveyParticipantRepo',
        method: 'getAll',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'getAll')

      expect(result).toBe('/survey-participant-repo')
    })

    it('handles single word service names', () => {
      const defaultObject = {}
      const resolver = new EndpointResolver(defaultObject)

      const endpointConfig: ServerApiConfigEndpoint = {
        service: 'user',
        method: 'getAll',
        verbs: ['get'],
      }

      const result = resolver.resolveEndpointPath(endpointConfig, 'getAll')

      expect(result).toBe('/user')
    })
  })
})
