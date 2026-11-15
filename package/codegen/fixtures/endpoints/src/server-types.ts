// Stand-in for `ServerApiConfig` from @datacapy/server, which codegen does not depend on.
export interface ServerApiConfig {
  service?: string
  path?: string | null
  enable?: boolean
  acl?: { rules?: { allow: boolean; role: string }[] }
  endpoints?: {
    [key: string]: {
      method?: string
      verbs?: string[]
      path?: string
      enable?: boolean
      data?: {
        [key: string]: {
          src?: string
          srcPath?: string
          required?: boolean
          type?: unknown
          defaultValue?: unknown
        }
      }
      acl?: { rules?: { allow: boolean; role: string }[] }
      response?: { error?: { [key: string]: { http?: { code?: number } } } }
    }
  }
}
