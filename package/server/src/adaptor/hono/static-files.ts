import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import * as path from 'path'

import type { Handler, StaticOptions } from '../types'
import { contentTypeForFile } from './content-type'

const DURATION_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

function maxAgeSeconds(maxAge: StaticOptions['maxAge']): number {
  if (typeof maxAge === 'number') return Math.floor(maxAge / 1000)
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(maxAge ?? '')
  if (!match) return 0
  return Math.floor((Number(match[1]) * DURATION_MS[match[2] ?? 'ms']) / 1000)
}

async function fileAt(
  candidate: string,
  index: string | false
): Promise<{ file: string; size: number; mtime: Date } | null> {
  try {
    const info = await stat(candidate)
    if (info.isFile())
      return { file: candidate, size: info.size, mtime: info.mtime }
    if (info.isDirectory() && index)
      return fileAt(path.join(candidate, index), false)
  } catch {
    // missing or unreadable: not a static file
  }
  return null
}

/** Serves files under `directory` for GET and HEAD, passing anything else on. */
export function createStaticHandler(
  directory: string,
  options: StaticOptions = {}
): Handler {
  const root = path.resolve(directory)
  const index = options.index === undefined ? 'index.html' : options.index
  const fallthrough = options.fallthrough !== false
  const seconds = maxAgeSeconds(options.maxAge)

  return async (req, res, next) => {
    const miss = () => {
      if (fallthrough) next()
      else res.status(404).end()
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return miss()

    let relative: string
    try {
      relative = decodeURIComponent(req.path)
    } catch {
      res.status(400).end()
      return
    }
    if (relative.includes('\0')) {
      res.status(400).end()
      return
    }

    const candidate = path.join(root, relative)
    if (candidate !== root && !candidate.startsWith(root + path.sep))
      return miss()

    const found = await fileAt(candidate, index)
    if (!found) return miss()

    const etag = `W/"${found.size.toString(16)}-${Math.floor(found.mtime.getTime()).toString(16)}"`
    res.header('Content-Type', contentTypeForFile(found.file))
    res.header('Cache-Control', `public, max-age=${seconds}`)
    res.header('Last-Modified', found.mtime.toUTCString())
    res.header('ETag', etag)
    if (req.get('if-none-match') === etag) {
      res.status(304).end()
      return
    }
    res.header('Content-Length', String(found.size))
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    await res.stream(createReadStream(found.file))
  }
}
