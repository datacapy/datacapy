// cspell:ignore Evictable
import { DataSourceInterface } from './interface'
import {
  DataSourceLookup,
  DataSourceConnectionDetails,
} from './lookup/interface'
import { DataSourceMysql } from './mysql'
import { DataSourceMongodb } from './mongodb'

/**
 * Configuration options for DataSourceRegistry
 */
export interface DataSourceRegistryConfig {
  /**
   * Maximum number of concurrent datasources to maintain.
   * When exceeded, LRU datasources are evicted.
   * Default: 50
   */
  maxSize?: number

  /**
   * Idle timeout in milliseconds.
   * Datasources idle longer than this are automatically closed.
   * Default: 30 minutes
   */
  idleTimeout?: number

  /**
   * Logger instance for logging events
   */
  logger?: Console

  /**
   * Maximum time (ms) remove() waits for an in-use datasource's refCount to reach 0 and any
   * active transaction leases to clear before giving up on closing it this pass.
   * Default: 30000 (30 seconds)
   */
  removeWaitTimeout?: number
}

/**
 * Metadata tracked for each datasource in the registry
 */
interface DataSourceEntry {
  dataSource: DataSourceInterface
  lastAccessed: number
  refCount: number
  createdAt: number
}

/**
 * DataSourceRegistry
 *
 * Manages a pool of dynamically created datasources with automatic lifecycle management.
 *
 * Features:
 * - Lazy creation: Create datasources on-demand when first accessed
 * - Connection reuse: Pool and reuse existing datasource connections
 * - LRU eviction: Automatically close least-recently-used datasources when pool reaches limit
 * - Idle timeout: Close datasources after period of inactivity
 * - Reference counting: Prevent closing during active queries
 * - Graceful shutdown: Close all connections cleanly
 */
export class DataSourceRegistry {
  private config: Required<DataSourceRegistryConfig>
  private registry: Map<string, DataSourceEntry> = new Map()
  private pending: Map<string, Promise<DataSourceInterface>> = new Map()
  private idleTimeoutTimer?: NodeJS.Timeout
  private shutdown: boolean = false

  constructor(config: DataSourceRegistryConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 50,
      idleTimeout: config.idleTimeout ?? 30 * 60 * 1000, // 30 minutes
      logger: config.logger ?? console,
      removeWaitTimeout: config.removeWaitTimeout ?? 30000, // 30 seconds
    }

    this.startBackgroundTasks()
  }

  /**
   * Get or create a datasource for the given key.
   *
   * @param key - Unique identifier for the datasource
   * @param factory - Factory function to create the datasource if not found
   * @returns DataSource instance
   */
  async getOrCreate(
    key: string,
    factory: () => Promise<DataSourceInterface>
  ): Promise<DataSourceInterface> {
    if (this.shutdown) {
      throw new Error('DataSourceRegistry is shutting down')
    }

    // Check if datasource exists
    const entry = this.registry.get(key)
    if (entry) {
      this.touch(entry)
      return entry.dataSource
    }

    // Join an in-flight creation for this key rather than racing a second factory() call -
    // concurrent misses (first access, or right after an eviction) would otherwise each create
    // their own datasource, with the last registry.set() silently orphaning the others (leaked
    // connections, corrupted refCount bookkeeping). The check-and-set on `this.pending` below is
    // synchronous (no await between the miss-check and the set), so no other call can interleave.
    const pending = this.pending.get(key)
    if (pending) {
      const dataSource = await pending
      const createdEntry = this.registry.get(key)
      if (createdEntry) {
        this.touch(createdEntry)
      }
      return dataSource
    }

    const creationPromise = (async (): Promise<DataSourceInterface> => {
      // Check if we need to evict before creating new
      if (this.registry.size >= this.config.maxSize) {
        await this.evictLRU()
      }

      const dataSource = await factory()

      // Store in registry
      this.registry.set(key, {
        dataSource,
        lastAccessed: Date.now(),
        refCount: 1,
        createdAt: Date.now(),
      })

      this.config.logger.log(`[DataSourceRegistry] Created datasource: ${key}`)

      return dataSource
    })()
    this.pending.set(key, creationPromise)

    try {
      return await creationPromise
    } catch (error) {
      this.config.logger.error(
        `[DataSourceRegistry] Failed to create datasource: ${key}`,
        error
      )
      throw error
    } finally {
      this.pending.delete(key)
    }
  }

  /**
   * Release a datasource reference (decrement ref count)
   *
   * @param key - Datasource key
   */
  release(key: string): void {
    const entry = this.registry.get(key)
    if (entry && entry.refCount > 0) {
      entry.refCount--
    }
  }

  /**
   * Check if a datasource exists in the registry
   *
   * @param key - Datasource key
   * @returns true if exists
   */
  has(key: string): boolean {
    return this.registry.has(key)
  }

  /**
   * Remove and close a specific datasource
   *
   * @param key - Datasource key
   * @param reason - Reason for removal (for logging)
   */
  async remove(key: string, reason: string = 'explicit'): Promise<void> {
    const entry = this.registry.get(key)
    if (!entry) {
      return
    }

    // Wait for active queries and active transaction leases to complete
    const maxWaitTime = this.config.removeWaitTimeout
    const startTime = Date.now()
    while (
      (entry.refCount > 0 || this.hasActiveLeases(entry)) &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (entry.refCount > 0 || this.hasActiveLeases(entry)) {
      // Never close a pool that's still in use - doing so breaks any in-flight caller with a
      // "Pool is closed" error. Leave the entry in the registry; it will be reconsidered on a
      // later eviction/idle-check pass once it actually goes idle. This is a soft, probabilistic
      // constraint on registry.maxSize/idleTimeout, not a hard guarantee - see
      // package/api/docs/project-databases.md.
      this.config.logger.error(
        `[DataSourceRegistry] Timed out waiting for active references/leases to clear, skipping close to avoid breaking in-flight callers: ${key}`
      )
      return
    }

    // Remove from registry
    this.registry.delete(key)

    // Close connection
    try {
      await entry.dataSource.close()
      this.config.logger.log(
        `[DataSourceRegistry] Removed datasource: ${key} (reason: ${reason}, age: ${Date.now() - entry.createdAt}ms)`
      )
    } catch (error) {
      this.config.logger.error(
        `[DataSourceRegistry] Error closing datasource: ${key}`,
        error
      )
    }
  }

  /**
   * Whether the given entry's datasource has an outstanding transaction lease. Datasources that
   * don't implement leases (e.g. mongodb, redis) always report false here.
   */
  private hasActiveLeases(entry: DataSourceEntry): boolean {
    return !!entry.dataSource.hasActiveLeases?.()
  }

  /**
   * Whether an entry is safe to close: no active references and no active transaction leases.
   */
  private isEvictable(entry: DataSourceEntry): boolean {
    return entry.refCount === 0 && !this.hasActiveLeases(entry)
  }

  /**
   * Record access to an entry: bump its last-accessed time and reference count.
   */
  private touch(entry: DataSourceEntry): void {
    entry.lastAccessed = Date.now()
    entry.refCount++
  }

  /**
   * Evict the least recently used datasource
   */
  private async evictLRU(): Promise<void> {
    let lruKey: string | null = null
    let lruTime = Infinity

    // Find LRU datasource with no active references and no active transaction leases
    for (const [key, entry] of this.registry.entries()) {
      if (this.isEvictable(entry) && entry.lastAccessed < lruTime) {
        lruKey = key
        lruTime = entry.lastAccessed
      }
    }

    if (lruKey) {
      await this.remove(lruKey, 'lru-eviction')
    } else {
      // All datasources have active references, log warning
      this.config.logger.warn(
        '[DataSourceRegistry] All datasources have active references, cannot evict'
      )
    }
  }

  /**
   * Close idle datasources (idle > idleTimeout)
   */
  private async closeIdleDatasources(): Promise<void> {
    const now = Date.now()
    const keysToRemove: string[] = []

    for (const [key, entry] of this.registry.entries()) {
      const idleTime = now - entry.lastAccessed
      if (this.isEvictable(entry) && idleTime > this.config.idleTimeout) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      await this.remove(key, 'idle-timeout')
    }
  }

  /**
   * Start background tasks (idle timeout)
   */
  private startBackgroundTasks(): void {
    // Idle timeout check
    this.idleTimeoutTimer = setInterval(
      async () => {
        try {
          await this.closeIdleDatasources()
        } catch (error) {
          this.config.logger.error(
            '[DataSourceRegistry] Error in idle timeout check',
            error
          )
        }
      },
      Math.min(this.config.idleTimeout / 2, 60000)
    ) // Check at half idle timeout, max 1 minute
    // Housekeeping only: must not keep the process alive if close() is never called
    this.idleTimeoutTimer.unref()
  }

  /**
   * Stop background tasks
   */
  private stopBackgroundTasks(): void {
    if (this.idleTimeoutTimer) {
      clearInterval(this.idleTimeoutTimer)
      this.idleTimeoutTimer = undefined
    }
  }

  /**
   * Close all datasources and shutdown registry
   */
  async close(): Promise<void> {
    this.shutdown = true
    this.stopBackgroundTasks()

    const keys = Array.from(this.registry.keys())
    for (const key of keys) {
      await this.remove(key, 'shutdown')
    }

    this.config.logger.log('[DataSourceRegistry] Shutdown complete')
  }

  /**
   * Get registry statistics (for monitoring)
   */
  getStats(): {
    size: number
    maxSize: number
    entries: Array<{
      key: string
      lastAccessed: number
      refCount: number
      idleTime: number
      age: number
    }>
  } {
    const now = Date.now()
    const entries = Array.from(this.registry.entries()).map(([key, entry]) => ({
      key,
      lastAccessed: entry.lastAccessed,
      refCount: entry.refCount,
      idleTime: now - entry.lastAccessed,
      age: now - entry.createdAt,
    }))

    return {
      size: this.registry.size,
      maxSize: this.config.maxSize,
      entries,
    }
  }

  /**
   * Create a datasource from connection details
   *
   * @param details - Connection details
   * @returns Connected datasource
   */
  async createDataSourceFromDetails(
    details: DataSourceConnectionDetails
  ): Promise<DataSourceInterface> {
    let dataSource: DataSourceInterface

    switch (details.type) {
      case 'mysql':
        dataSource = new DataSourceMysql({
          host: details.host,
          user: details.user,
          password: details.password,
          database: details.database,
          port: details.port,
          ...details.options,
        })
        break

      case 'mongodb':
        // Construct MongoDB connection URL from details
        const auth =
          details.user && details.password
            ? `${details.user}:${details.password}@`
            : ''
        const port = details.port ? `:${details.port}` : ''
        const mongoUrl = `mongodb://${auth}${details.host}${port}/${details.database}`

        dataSource = new DataSourceMongodb({
          url: mongoUrl,
          options: details.options,
        })
        break

      default:
        throw new Error(`Unsupported datasource type: ${details.type}`)
    }

    return DataSourceRegistry.connectWithRetry(dataSource)
  }

  /**
   * Build the registry key used to look up a dynamic datasource entry, given the datasource
   * name (e.g. 'project') and the context lookup key (e.g. a projectId). Centralised here so
   * every caller (DataSourceManager, Repo) constructs the same key format.
   *
   * @param dsName - Datasource name
   * @param lookupKey - Context lookup key
   * @returns Registry key
   */
  static makeKey(dsName: string, lookupKey: string): string {
    return `${dsName}:${lookupKey}`
  }

  /**
   * Connect a datasource, retrying on failure with a fixed delay between attempts.
   *
   * @param dataSource - DataSource instance to connect
   * @param opts - Retry options
   * @returns The connected datasource
   */
  static async connectWithRetry(
    dataSource: DataSourceInterface,
    opts: { maxAttempts?: number; waitMs?: number } = {}
  ): Promise<DataSourceInterface> {
    const maxAttempts = opts.maxAttempts ?? 3
    const waitMs = opts.waitMs ?? 500
    let attempt = 0

    const attemptConnect = async (): Promise<DataSourceInterface> => {
      attempt++
      try {
        await dataSource.connect()
        return dataSource
      } catch (error) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          return attemptConnect()
        } else {
          throw error
        }
      }
    }

    return attemptConnect()
  }
}

export default DataSourceRegistry
