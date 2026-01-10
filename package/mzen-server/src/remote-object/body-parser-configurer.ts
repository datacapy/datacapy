import * as bodyParser from 'body-parser'

export interface ServerBodyParserConfig {
  json?: {
    enable?: boolean
    limit?: string | boolean
    type?: string
  }
  urlencoded?: {
    enable?: boolean
    limit?: string | boolean
    extended?: boolean
    type?: string
  }
  text?: {
    enable?: boolean
    limit?: string | boolean
    type?: string
  }
  raw?: {
    enable?: boolean
    limit?: string | boolean
    type?: string
  }
}

/**
 * Responsible for configuring and creating body parser middleware
 * Follows Single Responsibility Principle and Open/Closed Principle
 */
export class BodyParserConfigurer {
  /**
   * Normalize body parser configuration with defaults
   */
  normalizeConfig(config: ServerBodyParserConfig): ServerBodyParserConfig {
    config = config ? config : {}
    const { json, urlencoded, text, raw } = config
    const jsonDefault = { enable: true, limit: '100kb' }
    const urlencodedDefault = { enable: false, limit: '100kb', extended: true }
    const textDefault = { enable: false, limit: '100kb' }
    const rawDefault = { enable: false, limit: '100kb' }

    return {
      json: json
        ? {
            enable:
              json.enable != undefined ? !!json.enable : jsonDefault.enable,
            limit: json.limit != undefined ? json.limit : jsonDefault.limit,
            type: json.type != undefined ? json.type : undefined,
          }
        : jsonDefault,
      urlencoded: urlencoded
        ? {
            enable:
              urlencoded.enable != undefined
                ? !!urlencoded.enable
                : urlencodedDefault.enable,
            limit:
              urlencoded.limit != undefined
                ? urlencoded.limit
                : urlencodedDefault.limit,
            extended:
              urlencoded.extended != undefined
                ? urlencoded.extended
                : urlencodedDefault.extended,
            type: urlencoded.type != undefined ? urlencoded.type : undefined,
          }
        : urlencodedDefault,
      text: text
        ? {
            enable:
              text.enable != undefined ? !!text.enable : textDefault.enable,
            limit: text.limit != undefined ? text.limit : textDefault.limit,
            type: text.type != undefined ? text.type : undefined,
          }
        : textDefault,
      raw: raw
        ? {
            enable: raw.enable != undefined ? !!raw.enable : rawDefault.enable,
            limit: raw.limit != undefined ? raw.limit : rawDefault.limit,
            type: raw.type != undefined ? raw.type : undefined,
          }
        : textDefault,
    }
  }

  /**
   * Create body parser middleware instances based on configuration
   */
  getMiddleware(bodyParserConfig: ServerBodyParserConfig): any[] {
    const { json, urlencoded, text, raw } = bodyParserConfig
    const middleware: any[] = []

    if (json && json.enable) {
      middleware.push(bodyParser.json(json))
    }
    if (urlencoded && urlencoded.enable) {
      middleware.push(bodyParser.urlencoded(urlencoded))
    }
    if (text && text.enable) {
      middleware.push(bodyParser.text(text))
    }
    if (raw && raw.enable) {
      middleware.push(bodyParser.text(raw))
    }

    return middleware
  }
}
