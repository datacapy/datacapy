/**
 * DataSourceContext
 *
 * Carries routing information for dynamic datasource resolution.
 * Flows from request → service → repo → datasource.
 *
 * The meaning of lookupKey is application-specific:
 * - In veysur: lookupKey = projectId (multi-project isolation)
 * - Other apps: lookupKey could be tenantId, customerId, orgId, etc.
 */
export interface DataSourceContextOptions {
  /**
   * Generic key used to look up datasource connection details.
   * Application-specific meaning (projectId, tenantId, etc.)
   */
  lookupKey?: string

  /**
   * Override: explicitly specify a named datasource to use.
   * Takes precedence over lookupKey-based resolution.
   */
  dataSourceKey?: string

  /**
   * Fallback flag: use default datasource if lookup fails.
   * Default: false (throw error on lookup failure)
   */
  useDefault?: boolean
}

export class DataSourceContext {
  public readonly lookupKey?: string
  public readonly dataSourceKey?: string
  public readonly useDefault: boolean

  constructor(options: DataSourceContextOptions = {}) {
    this.lookupKey = options.lookupKey
    this.dataSourceKey = options.dataSourceKey
    this.useDefault = options.useDefault ?? false
  }

  /**
   * Check if this context requires dynamic datasource resolution
   */
  isDynamic(): boolean {
    return !!this.lookupKey || !!this.dataSourceKey
  }

  /**
   * Create a new context with merged options
   */
  merge(options: DataSourceContextOptions): DataSourceContext {
    return new DataSourceContext({
      lookupKey: options.lookupKey ?? this.lookupKey,
      dataSourceKey: options.dataSourceKey ?? this.dataSourceKey,
      useDefault: options.useDefault ?? this.useDefault,
    })
  }

  /**
   * Create context from a lookup key (convenience method)
   */
  static fromLookupKey(key: string): DataSourceContext {
    return new DataSourceContext({ lookupKey: key })
  }

  /**
   * Create context from a datasource key (convenience method)
   */
  static fromDataSourceKey(key: string): DataSourceContext {
    return new DataSourceContext({ dataSourceKey: key })
  }
}
