import type { ResponseInterface } from '../remote-object/interfaces'

/**
 * True when something other than the automatic response already wrote to `res`
 * (a stream, a redirect, `res.end()`), so a second write must be skipped.
 */
export function isResponseHandled(
  res: ResponseInterface & { handled?: boolean }
): boolean {
  return res.handled === true || res.headersSent === true
}
