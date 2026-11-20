import type { HttpMethod } from './types'

const HTTP_METHODS: readonly string[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]

export function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHODS.includes(value)
}
