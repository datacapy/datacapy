# Dynamic DataSources - Advanced

## Overview

This guide covers advanced features for dynamic datasource management in
mzen-om. For basic usage of DataSourceContext and DataSourceLookup, see
[Dynamic DataSource](dynamic-datasource.md).

**Topics covered:**

- BaseDataSourceLookup - Abstract class with built-in caching
- DataSourceRegistry - Connection pool lifecycle management
- Advanced patterns - Cache invalidation, monitoring, graceful shutdown

## BaseDataSourceLookup

`BaseDataSourceLookup` is an abstract base class that provides automatic caching
for DataSourceLookup implementations. Use this when you want built-in TTL-based
caching without implementing it yourself.

### Constructor

```typescript
constructor(cacheTTL: number = 10 * 60 * 1000)
```

**Parameters:**

- `cacheTTL` - Cache time-to-live in milliseconds (default: 10 minutes)

### Implementation

Extend `BaseDataSourceLookup` and implement the abstract `performLookup` method:

```typescript
import { BaseDataSourceLookup, DataSourceConnectionDetails } from 'mzen-om'

class DatabaseLookup extends BaseDataSourceLookup {
  constructor(private db: Database) {
    super(10 * 60 * 1000) // 10 minute cache
  }

  protected async performLookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null> {
    // Query database for connection details
    const project = await this.db.projects.findOne({ _id: key })

    if (!project || !project.database) {
      return null
    }

    return {
      type: 'mysql',
      host: project.database.host,
      database: project.database.name,
      user: project.database.user,
      password: project.database.password,
      port: project.database.port,
    }
  }
}
```

### Caching Behaviour

- Automatic TTL-based caching (lookup results cached for `cacheTTL`
  milliseconds)
- Cache key format: `${dataSourceName}:${key}`
- Both successful lookups and null results are cached
- Cache is checked before calling `performLookup()`

### Optional Cache Invalidation

Override `performInvalidate()` to handle external cache invalidation:

```typescript
class RedisLookup extends BaseDataSourceLookup {
  constructor(private redis: RedisClient) {
    super(5 * 60 * 1000) // 5 minute cache
  }

  protected async performLookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null> {
    // Check Redis first
    const cached = await this.redis.get(`ds:${dataSourceName}:${key}`)
    if (cached) {
      return JSON.parse(cached)
    }

    // Fall back to database lookup
    const details = await this.fetchFromDatabase(key)

    // Cache in Redis
    if (details) {
      await this.redis.setex(
        `ds:${dataSourceName}:${key}`,
        300, // 5 minutes
        JSON.stringify(details)
      )
    }

    return details
  }

  protected async performInvalidate(
    dataSourceName: string,
    key: string
  ): Promise<void> {
    // Invalidate Redis cache
    await this.redis.del(`ds:${dataSourceName}:${key}`)
  }
}
```

### Utility Methods

**`clearCache(): void`** Clear all cached entries from memory:

```typescript
lookup.clearCache()
```

**`getCacheStats(): { size: number; keys: string[] }`** Get cache statistics for
monitoring:

```typescript
const stats = lookup.getCacheStats()
console.log(`Cache size: ${stats.size}`)
console.log(`Cached keys: ${stats.keys.join(', ')}`)
```

## DataSourceRegistry

The `DataSourceRegistry` manages a pool of dynamically-created datasource
instances with automatic lifecycle management.

### Features

- **Lazy creation** - Create datasources on-demand when first accessed
- **Connection reuse** - Pool and reuse existing datasource connections
- **LRU eviction** - Automatically close least-recently-used datasources when
  pool reaches limit
- **Reference counting** - Prevent closing datasources during active queries
- **Idle timeout** - Close datasources after period of inactivity
- **Health checks** - Periodic connection validation
- **Graceful shutdown** - Close all connections cleanly

### Configuration

```typescript
interface DataSourceRegistryConfig {
  /**
   * Maximum number of concurrent datasources to maintain.
   * When exceeded, LRU datasources are evicted.
   * Default: 50
   */
  maxSize?: number

  /**
   * Idle timeout in milliseconds.
   * Datasources idle longer than this are automatically closed.
   * Default: 30 minutes (1800000ms)
   */
  idleTimeout?: number

  /**
   * Health check interval in milliseconds.
   * Periodic connection validation frequency.
   * Default: 5 minutes (300000ms)
   */
  healthCheckInterval?: number

  /**
   * Logger instance for logging events
   */
  logger?: Console
}
```

### LRU Eviction

When the registry size exceeds `maxSize`:

1. Registry searches for the least-recently-used datasource with **zero active
   references**
2. If found, that datasource is removed and closed
3. If all datasources have active references, a warning is logged and no
   eviction occurs

**Important:** LRU only evicts datasources with `refCount === 0` to prevent
closing during active queries.

### Reference Counting

The registry tracks how many active operations are using each datasource:

- `getOrCreate()` increments `refCount`
- `release()` decrements `refCount`
- Datasources with `refCount > 0` cannot be evicted or closed by idle timeout
- During `remove()`, the registry waits up to 30 seconds for `refCount` to reach
  zero

### Background Tasks

The registry runs two background tasks:

**Idle Timeout Check** (runs every `idleTimeout / 2`, max 1 minute)

- Finds datasources with `refCount === 0` and `idleTime > idleTimeout`
- Closes and removes idle datasources

**Health Check** (runs every `healthCheckInterval`)

- Validates datasource connections
- Removes datasources that fail health checks

### Key Methods

**`getOrCreate(key, factory): Promise<DataSourceInterface>`**

Get or create a datasource for the given key:

```typescript
const dataSource = await registry.getOrCreate('project-123', async () => {
  return await registry.createDataSourceFromDetails({
    type: 'mysql',
    host: 'localhost',
    database: 'mydb',
    user: 'root',
    password: 'secret',
  })
})
```

- Returns existing datasource if found in registry
- Creates new datasource using factory if not found
- Updates `lastAccessed` timestamp and increments `refCount`
- Evicts LRU datasource if `maxSize` exceeded before creation

**`release(key): void`**

Decrement reference count after using a datasource:

```typescript
registry.release('project-123')
```

**`has(key): boolean`**

Check if a datasource exists in the registry:

```typescript
if (registry.has('project-123')) {
  // Datasource exists
}
```

**`remove(key, reason): Promise<void>`**

Remove and close a specific datasource:

```typescript
await registry.remove('project-123', 'configuration-changed')
```

- Waits up to 30 seconds for active queries to complete (`refCount === 0`)
- Force closes if timeout exceeded
- Logs removal with reason and datasource age

**`close(): Promise<void>`**

Graceful shutdown - close all datasources and stop background tasks:

```typescript
await registry.close()
```

**`getStats()`**

Get registry statistics for monitoring:

```typescript
const stats = registry.getStats()

console.log(`Active datasources: ${stats.size}/${stats.maxSize}`)

stats.entries.forEach((entry) => {
  console.log(`  ${entry.key}:`)
  console.log(`    Active refs: ${entry.refCount}`)
  console.log(`    Idle time: ${entry.idleTime}ms`)
  console.log(`    Age: ${entry.age}ms`)
})
```

Returns:

```typescript
{
  size: number // Current number of datasources
  maxSize: number // Maximum allowed datasources
  entries: Array<{
    key: string // Datasource key
    lastAccessed: number // Timestamp of last access
    refCount: number // Active reference count
    idleTime: number // Milliseconds since last access
    age: number // Milliseconds since creation
  }>
}
```

**`createDataSourceFromDetails(details): Promise<DataSourceInterface>`**

Factory method to create a datasource from connection details:

```typescript
const dataSource = await registry.createDataSourceFromDetails({
  type: 'mongodb',
  host: 'mongo.example.com',
  database: 'mydb',
  user: 'admin',
  password: 'secret',
  port: 27017,
  options: {
    replicaSet: 'rs0',
    ssl: true,
  },
})
```

- Supports `mysql` and `mongodb` datasource types
- Automatically connects with retry logic (3 attempts, 500ms delay)
- Throws error for unsupported datasource types

## Advanced Patterns

### Cache Invalidation

Use `BaseDataSourceLookup` with external cache invalidation:

```typescript
class ProjectLookup extends BaseDataSourceLookup {
  constructor(private eventBus: EventBus) {
    super(10 * 60 * 1000)

    // Listen for project configuration changes
    this.eventBus.on('project:updated', async (projectId) => {
      await this.invalidate('project', projectId)
    })
  }

  protected async performLookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null> {
    // ... fetch from database
  }
}
```

When configuration changes, call `invalidate()` to clear cached entry and
trigger `performInvalidate()`.

### Monitoring Registry Health

Periodically monitor registry statistics:

```typescript
setInterval(() => {
  const stats = registry.getStats()

  // Alert if approaching capacity
  const utilization = stats.size / stats.maxSize
  if (utilization > 0.8) {
    logger.warn(`DataSourceRegistry at ${utilization * 100}% capacity`)
  }

  // Alert on datasources with high ref counts
  stats.entries.forEach((entry) => {
    if (entry.refCount > 10) {
      logger.warn(`Datasource ${entry.key} has ${entry.refCount} active refs`)
    }
  })
}, 60000) // Check every minute
```

### Graceful Application Shutdown

Ensure all datasource connections close cleanly on shutdown:

```typescript
async function shutdown() {
  logger.info('Shutting down application...')

  // Stop accepting new requests
  await httpServer.close()

  // Close all datasource connections
  await registry.close()

  // Exit process
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

### Custom Cache Layers

For distributed caching (e.g., Redis), combine `BaseDataSourceLookup` with
external cache:

```typescript
class DistributedLookup extends BaseDataSourceLookup {
  constructor(
    private redis: RedisClient,
    private database: Database
  ) {
    // Short memory cache (1 minute)
    super(60 * 1000)
  }

  protected async performLookup(
    dataSourceName: string,
    key: string
  ): Promise<DataSourceConnectionDetails | null> {
    // Layer 1: Redis cache (shared across instances)
    const redisKey = `ds:${dataSourceName}:${key}`
    const cached = await this.redis.get(redisKey)

    if (cached) {
      return JSON.parse(cached)
    }

    // Layer 2: Database lookup
    const details = await this.database.lookupProject(key)

    // Cache in Redis (10 minutes)
    if (details) {
      await this.redis.setex(redisKey, 600, JSON.stringify(details))
    }

    return details
  }

  protected async performInvalidate(
    dataSourceName: string,
    key: string
  ): Promise<void> {
    // Invalidate Redis cache
    await this.redis.del(`ds:${dataSourceName}:${key}`)
  }
}
```

**Caching layers:**

1. Memory cache (BaseDataSourceLookup) - 1 minute, per-instance
2. Redis cache - 10 minutes, shared across instances
3. Database - source of truth

## Related Files

- **[src/data-source/lookup/interface.ts](../src/data-source/lookup/interface.ts)** -
  BaseDataSourceLookup implementation
- **[src/data-source/registry.ts](../src/data-source/registry.ts)** -
  DataSourceRegistry implementation
- **[src/data-source-manager.ts](../src/data-source-manager.ts)** - Integration
  layer

## See Also

- [Dynamic DataSource](dynamic-datasource.md) - Basic usage guide
- [Performance](performance.md) - Optimization strategies
- [Architecture](architecture.md) - System design
