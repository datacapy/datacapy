const UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
}

const DEFAULT_LIMIT = 100 * 1024

/** Bytes for a body-parser style limit: a number, or a string such as `100kb`. */
export function parseLimit(
  limit: string | number | boolean | undefined
): number {
  if (typeof limit === 'number') return limit
  if (typeof limit !== 'string') return DEFAULT_LIMIT
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i.exec(limit.trim())
  if (!match) return DEFAULT_LIMIT
  return Math.floor(Number(match[1]) * UNITS[(match[2] ?? 'b').toLowerCase()])
}
