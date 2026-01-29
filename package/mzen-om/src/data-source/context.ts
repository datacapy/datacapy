/**
 * DataSourceContext
 *
 * Carries routing information for dynamic datasource resolution.
 * Flows from request → service → repo → datasource.
 *
 * The meaning of lookupKey is application-specific:
 * - lookupKey could be tenantId, customerId, orgId, etc.
 */

/**
 * Context options for a specific datasource
 */
export interface DataSourceContextEntry {
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

/**
 * Map of datasource names to their context options.
 * Key is datasource name (e.g., 'project', 'tenant')
 */
export type DataSourceContextOptions = Record<string, DataSourceContextEntry>

export class DataSourceContext {
  private readonly dataSourceContexts: DataSourceContextOptions

  constructor(options: DataSourceContextOptions = {}) {
    this.dataSourceContexts = { ...options }
  }

  /**
   * Check if this context requires dynamic datasource resolution
   */
  isDynamic(): boolean {
    return Object.keys(this.dataSourceContexts).length > 0
  }

  /**
   * Get context for a specific datasource name
   * Returns the specific context only (no wildcard fallback)
   */
  getForDataSource(dataSourceName: string): DataSourceContextEntry | undefined {
    return this.dataSourceContexts[dataSourceName]
  }

  /**
   * Create a new context with merged options
   */
  merge(options: DataSourceContextOptions): DataSourceContext {
    return new DataSourceContext({ ...this.dataSourceContexts, ...options })
  }

  /**
   * Create multi-datasource context
   *
   * @example
   * const context = DataSourceContext.fromDataSources({
   *   project: { lookupKey: projectId },
   *   tenant: { lookupKey: tenantId },
   * })
   */
  static fromDataSources(
    dataSources: DataSourceContextOptions
  ): DataSourceContext {
    return new DataSourceContext(dataSources)
  }
}
