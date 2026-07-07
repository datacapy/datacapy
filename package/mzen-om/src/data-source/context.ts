import { DataSourceInterface } from './interface'

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

  // Deliberate exception to this class's otherwise immutable-by-convention design: the same
  // context instance is threaded by reference through every nested `repo.xxx({ context })` call
  // within one transaction() block, so mutating this slot in place lets every nested call
  // resolve the same lease without reassigning `context` at each call site.
  private activeDataSources: Record<string, DataSourceInterface> = {}

  constructor(options: DataSourceContextOptions = {}) {
    this.dataSourceContexts = { ...options }
  }

  /**
   * Bind an active (already-resolved) datasource - typically a transaction lease - for a given
   * datasource name. While set, Repo#getDataSource() returns it directly instead of resolving
   * via the registry.
   */
  setActiveDataSource(
    dataSourceName: string,
    dataSource: DataSourceInterface
  ): void {
    this.activeDataSources[dataSourceName] = dataSource
  }

  /**
   * Get the active datasource bound for a given datasource name, if any.
   */
  getActiveDataSource(dataSourceName: string): DataSourceInterface | undefined {
    return this.activeDataSources[dataSourceName]
  }

  /**
   * Clear the active datasource bound for a given datasource name.
   */
  clearActiveDataSource(dataSourceName: string): void {
    delete this.activeDataSources[dataSourceName]
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
