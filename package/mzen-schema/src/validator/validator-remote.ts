import { ObjectPathAccessor } from '../utilities/object-path-accessor'

export class ValidatorRemote {
  validate(value: any, options?) {
    const url = options?.url ?? ''
    const method = options?.method ?? 'POST'
    const params = options?.params ?? {}
    const paramPaths = options?.paramPaths ?? {}
    const data = options?.data ?? {}
    const dataPaths = options?.dataPaths ?? {}
    const root = options?.root ?? {}
    const timeout = options?.timeout ?? 5000
    const axiosInstance = options?.axios

    if (!axiosInstance) {
      throw new Error('Remote validator requires an axios instance')
    }

    // Build params from paths
    const resolvedParams = {
      ...this.pathsToObject(paramPaths, root),
      ...params,
    }

    // Build data from paths, include the value being validated
    const resolvedData = {
      ...this.pathsToObject(dataPaths, root),
      ...data,
      value,
    }

    // Returns the promise - network errors will propagate up
    // API response.data should return: true | string | string[]
    return axiosInstance({
      url,
      method,
      params: resolvedParams,
      data: resolvedData,
      timeout,
    }).then((response) => response.data)
  }

  private pathsToObject(
    paths: Record<string, string>,
    data: any
  ): Record<string, any> {
    const result: Record<string, any> = {}
    Object.keys(paths).forEach((fieldName) => {
      result[fieldName] = ObjectPathAccessor.getPath(paths[fieldName], data)
    })
    return result
  }

  getName() {
    return 'remote'
  }
}

export default ValidatorRemote
