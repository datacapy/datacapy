import qs from 'qs'
import querystring from 'querystring'

import type { ServerBodyParserConfig } from '../../remote-object/body-parser-configurer'
import type { Handler } from '../types'
import { mediaType } from './content-type'
import { HonoRequest, payloadError } from './hono-request'
import { parseLimit } from './limit'

type Kind = 'json' | 'urlencoded' | 'text' | 'raw'

interface ParserOptions {
  limit?: string | number | boolean
  type?: string
  extended?: boolean
}

const DEFAULT_TYPES: Record<Kind, string> = {
  json: 'application/json',
  urlencoded: 'application/x-www-form-urlencoded',
  text: 'text/plain',
  raw: 'application/octet-stream',
}

/** Exact, `type/*`, `*\/*` and `type/*+suffix` patterns. */
function matches(actual: string, pattern: string): boolean {
  const wanted = pattern.toLowerCase()
  if (wanted === '*/*' || wanted === actual) return true
  const [wantedType, wantedSub] = wanted.split('/')
  const [actualType, actualSub = ''] = actual.split('/')
  if (wantedType !== actualType || !wantedSub) return false
  if (wantedSub === '*') return true
  if (wantedSub.startsWith('*+')) return actualSub.endsWith(wantedSub.slice(1))
  return false
}

function charsetOf(contentType: string | undefined): string {
  const match = /;\s*charset=("?)([^";]+)\1/i.exec(contentType ?? '')
  return match ? match[2].trim().toLowerCase() : 'utf-8'
}

function decodeText(buffer: Buffer, contentType: string | undefined): string {
  const charset = charsetOf(contentType)
  if (charset !== 'utf-8' && charset !== 'utf8') {
    throw payloadError(
      415,
      'charset.unsupported',
      `unsupported charset "${charset.toUpperCase()}"`
    )
  }
  return buffer.toString('utf8')
}

function parseJson(text: string): unknown {
  if (text.length === 0) return {}
  if (!/^\s*[{[]/.test(text)) {
    throw payloadError(400, 'entity.parse.failed', 'Unexpected token in JSON')
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw payloadError(400, 'entity.parse.failed', (error as Error).message)
  }
}

function hasBody(req: HonoRequest): boolean {
  return (
    req.headers['transfer-encoding'] !== undefined ||
    !Number.isNaN(Number(req.get('content-length')))
  )
}

function createParser(kind: Kind, options: ParserOptions): Handler {
  const limit = parseLimit(options.limit)
  const type = options.type ?? DEFAULT_TYPES[kind]

  return async (req, _res, next) => {
    if (!(req instanceof HonoRequest)) {
      next(
        new Error(
          'Hono body parsers need a request created by the Hono adaptor'
        )
      )
      return
    }
    const contentType = req.get('content-type')
    if (
      req.body !== undefined ||
      !hasBody(req) ||
      !matches(mediaType(contentType), type)
    ) {
      next()
      return
    }
    try {
      const buffer = await req.readBody(limit)
      if (kind === 'raw') {
        req.body = buffer
      } else {
        const text = decodeText(buffer, contentType)
        if (kind === 'text') req.body = text
        else if (kind === 'json') req.body = parseJson(text)
        else {
          req.body =
            options.extended === false
              ? { ...querystring.parse(text) }
              : qs.parse(text, {
                  allowPrototypes: true,
                  arrayLimit: 100,
                  depth: 32,
                  parameterLimit: 1000,
                })
        }
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

/** One handler per enabled parser, in the order Express's body-parser chain runs them. */
export function createBodyParsers(config: ServerBodyParserConfig): Handler[] {
  const parsers: Handler[] = []
  const kinds: Kind[] = ['json', 'urlencoded', 'text', 'raw']
  for (const kind of kinds) {
    const options = config[kind]
    if (options?.enable) parsers.push(createParser(kind, options))
  }
  return parsers
}
