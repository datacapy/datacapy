/**
 * Translates the datacapy path syntax (`:name` segments and a trailing
 * `/*name`) to Hono's: a trailing wildcard becomes a regex param that keeps
 * the rest of the path in one string. A trailing slash is dropped: Hono's
 * non-strict mode ignores one on the request, but not on a registered route.
 */
export function toHonoPath(path: string): string {
  const wildcard = path.replace(/\/\*([A-Za-z_]\w*)$/, '/:$1{.+}')
  return wildcard.length > 1 ? wildcard.replace(/\/+$/, '') : wildcard
}
