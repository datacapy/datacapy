/**
 * DataSourceLookup Interface
 *
 * Pluggable strategy for discovering datasource connection details
 * based on a lookup key.
 *
 * The interface is deliberately generic. The meaning of `key` is
 * application-specific:
 * - Multi-workspace apps: key = workspaceId
 * - Other apps: key could be tenantId, userId, orgId, etc.
 *
 * Example implementations:
 * - DatabaseLookup: Query connection details from database
 * - ConfigLookup: Read from config file (static multi-tenant config)
 * - ApiLookup: Call external API to get connection details
 * - EnvironmentLookup: Use environment variables with templates
 */
export interface DataSourceLookup {
  /**
   * Look up connection details by datasource name and generic key.
   *
   * @param dataSourceName - The logical datasource name (e.g., 'workspace', 'tenant')
   * @param key - Application-specific identifier (workspaceId, tenantId, etc.)
   * @returns Connection details or null if not found
   * @throws Error if lookup fails (network error, etc.)
   */
  lookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null>

  /**
   * Optional: Invalidate cache when datasource config changes.
   *
   * @param dataSourceName - The datasource name to invalidate
   * @param key - The key to invalidate from cache
   */
  invalidate?(dataSourceName: string, key: string): Promise<void>
}

/**
 * Generic datasource connection details.
 * Contains fields common across datasource types.
 */
export interface DataSourceConnectionDetails {
  /**
   * Datasource type identifier.
   * Should match registered datasource types in ModelManager.
   */
  type: string

  /**
   * Database host/server address
   */
  host: string

  /**
   * Database name
   */
  database: string

  /**
   * Database user (optional, some datasources support anonymous)
   */
  user?: string

  /**
   * Database password (optional)
   */
  password?: string

  /**
   * Database port (optional, uses datasource default if not specified)
   */
  port?: number

  /**
   * Additional datasource-specific configuration.
   * Type-specific options like:
   * - MySQL: charset, timezone, connectionLimit
   * - MongoDB: replicaSet, authSource, ssl options
   * - Postgres: ssl, statement_timeout, idle_in_transaction_session_timeout
   */
  options?: Record<string, any>
}

/**
 * Base class for DataSourceLookup implementations with caching support
 */
export abstract class BaseDataSourceLookup implements DataSourceLookup {
  protected cache: Map<
    string,
    { data: DataSourceConnectionDetails | null; timestamp: number }
  > = new Map()
  protected cacheTTL: number

  constructor(cacheTTL: number = 10 * 60 * 1000) {
    this.cacheTTL = cacheTTL
  }

  protected getCacheKey(dataSourceName: string, key: string): string {
    return `${dataSourceName}:${key}`
  }

  async lookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null> {
    const cacheKey = this.getCacheKey(dataSourceName, key)

    // Check cache
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }

    // Perform lookup
    const data = await this.performLookup(dataSourceName, key)

    // Cache result
    this.cache.set(cacheKey, { data, timestamp: Date.now() })

    return data
  }

  async invalidate(dataSourceName: string, key: string): Promise<void> {
    const cacheKey = this.getCacheKey(dataSourceName, key)
    this.cache.delete(cacheKey)
    await this.performInvalidate(dataSourceName, key)
  }

  /**
   * Implement this method to perform the actual lookup
   */
  protected abstract performLookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null>

  /**
   * Optional: Implement this to handle cache invalidation beyond memory cache
   */
  protected async performInvalidate(
    dataSourceName: string,
    key: string
  ): Promise<void> {
    // Default: no-op
  }

  /**
   * Clear all cached entries
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}
