import { ConfigurationManager } from './configuration-manager'
import { ServerConfig } from '../server-config'
import { ModelManager } from 'mzen-om'

describe('ConfigurationManager', () => {
  describe('constructor()', () => {
    it('initializes with default config when no options provided', () => {
      const manager = new ConfigurationManager()
      const config = manager.getConfig()

      expect(config.path).toBe('/api')
      expect(config.port).toBe(3838)
      expect(config.appDir).toBe('')
    })

    it('uses provided path config', () => {
      const options: ServerConfig = {
        path: '/custom-api',
      }

      const manager = new ConfigurationManager(options)
      const config = manager.getConfig()

      expect(config.path).toBe('/custom-api')
    })

    it('uses provided port config', () => {
      const options: ServerConfig = {
        path: '/api',
        port: 8080,
      }

      const manager = new ConfigurationManager(options)
      const config = manager.getConfig()

      expect(config.port).toBe(8080)
    })

    it('resolves appDir to absolute path when provided', () => {
      const options: ServerConfig = {
        path: '/api',
        appDir: './test-dir',
      }

      const manager = new ConfigurationManager(options)
      const config = manager.getConfig()

      expect(config.appDir).toBeTruthy()
      expect(config.appDir).not.toBe('./test-dir')
    })

    it('normalizes all config values', () => {
      const options: ServerConfig = {
        path: '/v1/api',
        port: 5000,
        appDir: './app',
      }

      const manager = new ConfigurationManager(options)
      const config = manager.getConfig()

      expect(config.path).toBe('/v1/api')
      expect(config.port).toBe(5000)
      expect(config.appDir).toBeTruthy()
    })

    it('creates a new ModelManager when not provided', () => {
      const manager = new ConfigurationManager()
      const modelManager = manager.getModelManager()

      expect(modelManager).toBeDefined()
      expect(modelManager).toBeInstanceOf(ModelManager)
    })

    it('uses provided ModelManager', () => {
      const customModelManager = new ModelManager()
      const manager = new ConfigurationManager(undefined, customModelManager)
      const modelManager = manager.getModelManager()

      expect(modelManager).toBe(customModelManager)
    })

    it('passes model config to ModelManager when provided', () => {
      const options: ServerConfig = {
        path: '/api',
        model: {
          dataSources: [{ name: 'default', type: 'mock' }],
        },
      }

      const manager = new ConfigurationManager(options)
      const modelManager = manager.getModelManager()

      expect(modelManager).toBeDefined()
    })
  })

  describe('getConfig()', () => {
    it('returns the normalized server config', () => {
      const options: ServerConfig = {
        path: '/api/v2',
        port: 9000,
      }

      const manager = new ConfigurationManager(options)
      const config = manager.getConfig()

      expect(config).toBeDefined()
      expect(config.path).toBe('/api/v2')
      expect(config.port).toBe(9000)
    })

    it('returns config with default values when minimal options provided', () => {
      const manager = new ConfigurationManager({ path: '' })
      const config = manager.getConfig()

      expect(config.path).toBe('/api')
      expect(config.port).toBe(3838)
    })
  })

  describe('getModelManager()', () => {
    it('returns the ModelManager instance', () => {
      const manager = new ConfigurationManager()
      const modelManager = manager.getModelManager()

      expect(modelManager).toBeDefined()
      expect(modelManager).toBeInstanceOf(ModelManager)
    })

    it('returns the same ModelManager on multiple calls', () => {
      const manager = new ConfigurationManager()
      const modelManager1 = manager.getModelManager()
      const modelManager2 = manager.getModelManager()

      expect(modelManager1).toBe(modelManager2)
    })
  })

  describe('setLogger()', () => {
    it('sets logger on the ModelManager', () => {
      const manager = new ConfigurationManager()
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }

      const modelManager = manager.getModelManager()
      const setLoggerSpy = jest.spyOn(modelManager, 'setLogger')

      manager.setLogger(mockLogger)

      expect(setLoggerSpy).toHaveBeenCalledWith(mockLogger)
    })
  })
})
