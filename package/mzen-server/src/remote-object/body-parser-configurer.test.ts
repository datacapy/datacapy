import {
  BodyParserConfigurer,
  ServerBodyParserConfig,
} from './body-parser-configurer'

describe('BodyParserConfigurer', () => {
  let configurer: BodyParserConfigurer

  beforeEach(() => {
    configurer = new BodyParserConfigurer()
  })

  describe('normalizeConfig()', () => {
    it('returns default config when no config provided', () => {
      const result = configurer.normalizeConfig({})

      expect(result.json).toEqual({ enable: true, limit: '100kb' })
      expect(result.urlencoded).toEqual({
        enable: false,
        limit: '100kb',
        extended: true,
      })
      expect(result.text).toEqual({ enable: false, limit: '100kb' })
      expect(result.raw).toEqual({ enable: false, limit: '100kb' })
    })

    it('merges json config with defaults', () => {
      const config: ServerBodyParserConfig = {
        json: {
          enable: false,
          limit: '10mb',
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.json).toEqual({
        enable: false,
        limit: '10mb',
        type: undefined,
      })
    })

    it('merges urlencoded config with defaults', () => {
      const config: ServerBodyParserConfig = {
        urlencoded: {
          enable: true,
          limit: '50mb',
          extended: false,
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.urlencoded).toEqual({
        enable: true,
        limit: '50mb',
        extended: false,
        type: undefined,
      })
    })

    it('merges text config with defaults', () => {
      const config: ServerBodyParserConfig = {
        text: {
          enable: true,
          limit: '1mb',
          type: 'text/plain',
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.text).toEqual({
        enable: true,
        limit: '1mb',
        type: 'text/plain',
      })
    })

    it('merges raw config with defaults', () => {
      const config: ServerBodyParserConfig = {
        raw: {
          enable: true,
          limit: '5mb',
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.raw).toEqual({
        enable: true,
        limit: '5mb',
        type: undefined,
      })
    })

    it('handles enable flag correctly when explicitly set to false', () => {
      const config: ServerBodyParserConfig = {
        json: {
          enable: false,
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.json?.enable).toBe(false)
    })

    it('handles enable flag correctly when explicitly set to true', () => {
      const config: ServerBodyParserConfig = {
        urlencoded: {
          enable: true,
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.urlencoded?.enable).toBe(true)
    })

    it('preserves custom type settings', () => {
      const config: ServerBodyParserConfig = {
        json: {
          type: 'application/vnd.api+json',
        },
        text: {
          type: 'text/html',
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.json?.type).toBe('application/vnd.api+json')
      expect(result.text?.type).toBe('text/html')
    })

    it('handles limit as boolean', () => {
      const config: ServerBodyParserConfig = {
        json: {
          limit: false,
        },
      }

      const result = configurer.normalizeConfig(config)

      expect(result.json?.limit).toBe(false)
    })
  })

  describe('getMiddleware()', () => {
    it('returns json middleware when json is enabled', () => {
      const config: ServerBodyParserConfig = {
        json: {
          enable: true,
          limit: '100kb',
        },
      }

      const normalized = configurer.normalizeConfig(config)
      const middleware = configurer.getMiddleware(normalized)

      expect(middleware).toBeInstanceOf(Array)
      expect(middleware.length).toBeGreaterThan(0)
    })

    it('returns empty array when no parsers are enabled', () => {
      const config: ServerBodyParserConfig = {
        json: {
          enable: false,
        },
        urlencoded: {
          enable: false,
        },
        text: {
          enable: false,
        },
        raw: {
          enable: false,
        },
      }

      const normalized = configurer.normalizeConfig(config)
      const middleware = configurer.getMiddleware(normalized)

      expect(middleware).toEqual([])
    })

    it('returns multiple middleware when multiple parsers are enabled', () => {
      const config: ServerBodyParserConfig = {
        json: {
          enable: true,
        },
        urlencoded: {
          enable: true,
        },
      }

      const normalized = configurer.normalizeConfig(config)
      const middleware = configurer.getMiddleware(normalized)

      expect(middleware.length).toBe(2)
    })

    it('returns all middleware types when all are enabled', () => {
      const config: ServerBodyParserConfig = {
        json: {
          enable: true,
        },
        urlencoded: {
          enable: true,
        },
        text: {
          enable: true,
        },
        raw: {
          enable: true,
        },
      }

      const normalized = configurer.normalizeConfig(config)
      const middleware = configurer.getMiddleware(normalized)

      expect(middleware.length).toBe(4)
    })
  })
})
