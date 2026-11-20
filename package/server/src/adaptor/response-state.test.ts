import type { ResponseInterface } from '../remote-object/interfaces'
import { isResponseHandled } from './response-state'

function makeRes(
  state: { headersSent?: boolean; handled?: boolean } = {}
): ResponseInterface & { handled?: boolean } {
  const res: ResponseInterface & { handled?: boolean } = {
    status: () => res,
    json: () => res,
    send: () => res,
    type: () => res,
    end: () => undefined,
    headersSent: false,
    ...state,
  }
  return res
}

describe('isResponseHandled', () => {
  it('is false for a fresh response', () => {
    expect(isResponseHandled(makeRes())).toBe(false)
  })

  it('is true once headers are sent', () => {
    expect(isResponseHandled(makeRes({ headersSent: true }))).toBe(true)
  })

  it('is true when the adaptor marks it handled', () => {
    expect(isResponseHandled(makeRes({ handled: true }))).toBe(true)
  })
})
