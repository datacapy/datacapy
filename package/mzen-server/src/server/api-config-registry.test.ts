import { ApiConfigRegistry } from './api-config-registry'
import { ServerApiConfig } from '../api-config'

describe('ApiConfigRegistry', () => {
  let registry: ApiConfigRegistry

  beforeEach(() => {
    registry = new ApiConfigRegistry()
  })

  describe('constructor()', () => {
    it('initializes with empty api configs array', () => {
      const configs = registry.getApiConfigs()

      expect(configs).toEqual([])
    })
  })

  describe('addApiConfig()', () => {
    it('adds a single api config to the registry', () => {
      const config: ServerApiConfig = {
        service: 'UserService',
        enable: true,
      }

      registry.addApiConfig(config)
      const configs = registry.getApiConfigs()

      expect(configs).toHaveLength(1)
      expect(configs[0]).toBe(config)
    })

    it('adds multiple api configs sequentially', () => {
      const config1: ServerApiConfig = {
        service: 'UserService',
        enable: true,
      }
      const config2: ServerApiConfig = {
        service: 'PostService',
        enable: true,
      }

      registry.addApiConfig(config1)
      registry.addApiConfig(config2)
      const configs = registry.getApiConfigs()

      expect(configs).toHaveLength(2)
      expect(configs[0]).toBe(config1)
      expect(configs[1]).toBe(config2)
    })

    it('preserves order of added configs', () => {
      const configs: ServerApiConfig[] = [
        { service: 'Service1', enable: true },
        { service: 'Service2', enable: true },
        { service: 'Service3', enable: true },
      ]

      configs.forEach((config) => registry.addApiConfig(config))
      const result = registry.getApiConfigs()

      expect(result[0]).toBe(configs[0])
      expect(result[1]).toBe(configs[1])
      expect(result[2]).toBe(configs[2])
    })
  })

  describe('addApiConfigs()', () => {
    it('adds multiple api configs at once', () => {
      const configs: ServerApiConfig[] = [
        { service: 'UserService', enable: true },
        { service: 'PostService', enable: true },
        { service: 'CommentService', enable: true },
      ]

      registry.addApiConfigs(configs)
      const result = registry.getApiConfigs()

      expect(result).toHaveLength(3)
      expect(result).toEqual(configs)
    })

    it('handles empty array', () => {
      registry.addApiConfigs([])
      const configs = registry.getApiConfigs()

      expect(configs).toEqual([])
    })

    it('appends to existing configs', () => {
      const existingConfig: ServerApiConfig = {
        service: 'ExistingService',
        enable: true,
      }
      registry.addApiConfig(existingConfig)

      const newConfigs: ServerApiConfig[] = [
        { service: 'NewService1', enable: true },
        { service: 'NewService2', enable: true },
      ]
      registry.addApiConfigs(newConfigs)
      const result = registry.getApiConfigs()

      expect(result).toHaveLength(3)
      expect(result[0]).toBe(existingConfig)
      expect(result[1]).toBe(newConfigs[0])
      expect(result[2]).toBe(newConfigs[1])
    })

    it('can be called multiple times', () => {
      const configs1: ServerApiConfig[] = [
        { service: 'Service1', enable: true },
      ]
      const configs2: ServerApiConfig[] = [
        { service: 'Service2', enable: true },
      ]

      registry.addApiConfigs(configs1)
      registry.addApiConfigs(configs2)
      const result = registry.getApiConfigs()

      expect(result).toHaveLength(2)
      expect(result[0]).toBe(configs1[0])
      expect(result[1]).toBe(configs2[0])
    })
  })

  describe('getApiConfigs()', () => {
    it('returns empty array when no configs added', () => {
      const configs = registry.getApiConfigs()

      expect(configs).toEqual([])
    })

    it('returns all added api configs', () => {
      const configs: ServerApiConfig[] = [
        { service: 'UserService', enable: true },
        { service: 'PostService', enable: true },
      ]

      registry.addApiConfigs(configs)
      const result = registry.getApiConfigs()

      expect(result).toHaveLength(2)
      expect(result).toEqual(configs)
    })
  })
})
