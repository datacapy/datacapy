import { ServerApiConfig, ServerApiConfigEndpoint } from '../api-config'

/**
 * Finds mismatches between the `:name` segments of an endpoint path and the
 * `data` entries that read them (`src: 'param'`). Express yields `undefined`
 * for either mismatch, so they otherwise fail silently.
 */
export class EndpointPathChecker {
  check(config: ServerApiConfig): string[] {
    const problems: string[] = []
    const servicePathParams = this.pathParams(config.path)
    const endpoints = config.endpoints ?? {}
    for (const name of Object.keys(endpoints)) {
      problems.push(
        ...this.checkEndpoint(name, endpoints[name], servicePathParams)
      )
    }
    return problems
  }

  private checkEndpoint(
    name: string,
    endpoint: ServerApiConfigEndpoint,
    servicePathParams: string[]
  ): string[] {
    const pathParams = [...servicePathParams, ...this.pathParams(endpoint.path)]
    const dataParams = Object.entries(endpoint.data ?? {})
      .filter(([, data]) => data.src === 'param')
      .map(([key, data]) => data.srcPath ?? key)

    const problems: string[] = []
    for (const param of pathParams) {
      if (!dataParams.includes(param)) {
        problems.push(
          `endpoint "${name}": path param ":${param}" has no data entry with src 'param'`
        )
      }
    }
    for (const param of dataParams) {
      if (!pathParams.includes(param)) {
        problems.push(
          `endpoint "${name}": data entry reads param "${param}" but the path has no ":${param}"`
        )
      }
    }
    return problems
  }

  private pathParams(path: string | null | undefined): string[] {
    if (!path) return []
    return Array.from(path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g), (m) => m[1])
  }
}
