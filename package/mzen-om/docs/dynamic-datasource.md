# DataSource Context

## Overview

The DataSourceContext system enables dynamic datasource routing at runtime. This
is essential for multi-tenant architectures where different entities route to
different databases based on request context.

## Core Concepts

**DataSourceContext** - Carries routing information for dynamic datasource
resolution. Flows from request → service → repo → datasource.

**DataSourceLookup** - Interface for resolving datasource connection details
based on a lookup key (e.g., projectId, tenantId).

**DataSourceRegistry** - Manages a pool of dynamically-created datasource
instances with LRU eviction and idle timeout.

## API

### Creating Contexts

All contexts must explicitly specify datasource names:

```typescript
import { DataSourceContext } from 'mzen-om'

// Single datasource
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
})

// Multiple datasources
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})
```

### Configuring Lookups

Each datasource must have a registered lookup implementation:

```typescript
// Configure lookup for 'project' datasource
modelManager.setDataSourceLookup('project', projectLookup)

// Configure lookup for 'tenant' datasource
modelManager.setDataSourceLookup('tenant', tenantLookup)
```

### DataSourceLookup Interface

Implement this interface to provide datasource details:

```typescript
interface DataSourceLookup {
  /**
   * Look up datasource connection details
   * @param dataSourceName - Name of datasource (e.g., 'project', 'tenant')
   * @param lookupKey - Key to resolve (e.g., projectId, tenantId)
   * @returns Connection details or undefined if not found
   */
  lookup(
    dataSourceName: string,
    lookupKey: string
  ): Promise<DataSourceDetails | undefined>
}
```

**Example implementation:**

```typescript
class ProjectLookup implements DataSourceLookup {
  async lookup(dataSourceName: string, lookupKey: string) {
    // Look up project configuration from database
    const project = await db.projects.findOne({ _id: lookupKey })

    if (!project) {
      return undefined
    }

    return {
      type: 'mongodb',
      config: {
        uri: project.databaseUri,
        database: project.databaseName,
      },
    }
  }
}
```

## Resolution Flow

1. **Service creates context** with explicit datasource names and lookup keys
2. **Repo receives context** in query options
3. **Repo resolves datasource** by calling `getDataSource(context)`
4. **DataSourceManager gets entry** from context for repo's configured
   datasource name
5. **DataSourceManager checks lookup** registry for that datasource name
6. **If lookup exists**, calls `lookup(dataSourceName, lookupKey)` to get
   connection details
7. **DataSourceRegistry** creates or reuses connection pool for that specific
   database
8. **Query executes** on the resolved datasource

## Repository Configuration

Repos specify their datasource name in config:

```typescript
export class RepoSurvey extends Repo<Survey> {
  constructor() {
    super({
      name: 'survey',
      dataSource: 'project', // Dynamic datasource
    })
  }
}

export class RepoUser extends Repo<User> {
  constructor() {
    super({
      name: 'user',
      // No dataSource specified - uses default static datasource
    })
  }
}
```

## Common Patterns

### Service Layer

```typescript
async getAll({ projectId, ...params }) {
  const context = DataSourceContext.fromDataSources({
    project: { lookupKey: projectId }
  })

  const repo = this.getRepo('survey')
  const surveys = await repo.find(query, { context })
  return surveys
}
```

### Cross-Datasource Relations

```typescript
// Survey (project datasource) has relation to Tenant (tenant datasource)
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})

await repoSurvey.findOne(surveyId, {
  context,
  populate: {
    tenant: true, // Automatically uses 'tenant' context
  },
})
```

### Transactions

Each transactional caller gets its own dedicated connection lease — never call
`transactionStart()`/`transactionCommit()`/`transactionRollback()` directly on a
shared datasource; use `repo.transaction()` instead:

```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
})

const repo = this.getRepo('survey')
await repo.transaction(context, async (txContext) => {
  await repo.deleteOne({ _id: surveyId }, { context: txContext })
})
```

`repo.transaction()` checks out a dedicated connection lease, runs the callback,
then commits on success or rolls back on error — always releasing the lease
afterwards.

**The callback receives a new tx-scoped context (`txContext`), not the original
`context`.** Every nested repo call made inside the transaction must be passed
`txContext`, not the outer `context` — otherwise that call silently resolves to
a non-transactional datasource instead of erroring.

## Error Handling

### Missing Lookup Configuration

```
Error: No DataSourceLookup configured for datasource "project".
Available datasources: tenant, customer
```

**Solution:** Register the lookup:

```typescript
modelManager.setDataSourceLookup('project', lookup)
```

### Missing Context

```
Error: No datasource context provided for dynamic repo: survey.
Provide context with lookupKey or dataSourceKey in query options.
```

**Solution:** Create and pass context:

```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
})
await repo.find(query, { context })
```

## Design Decisions

1. **Explicit Datasource Names** - All contexts require explicit datasource
   names (no wildcard fallback)
   - Rationale: Clear intent, easier debugging, prevents accidental misrouting

2. **Per-Datasource Lookup Registration** - Each datasource has its own lookup
   implementation
   - Rationale: Supports future scenarios with multiple dynamic datasources
     (e.g., project + tenant)

3. **Map-Based Lookup Storage** -
   `dataSourceLookups: Map<string, DataSourceLookup>`
   - Rationale: O(1) lookup, clear separation, easy to extend

4. **Error Messages Include Available Datasources** - When lookup missing, shows
   what's configured
   - Rationale: Helps developers quickly identify configuration issues

## Performance Considerations

### Connection Pooling

- Each resolved datasource maintains its own connection pool
- Registry uses LRU eviction (default: 50 datasources)
- Idle timeout: 30 minutes (configurable)

### Lookup Caching

Implement caching in your DataSourceLookup implementation:

```typescript
class CachedProjectLookup implements DataSourceLookup {
  private cache = new Map<string, DataSourceDetails>()
  private cacheTTL = 10 * 60 * 1000 // 10 minutes

  async lookup(dataSourceName: string, lookupKey: string) {
    const cacheKey = `${dataSourceName}:${lookupKey}`
    const cached = this.cache.get(cacheKey)

    if (cached && !this.isExpired(cached)) {
      return cached
    }

    const details = await this.fetchFromDatabase(lookupKey)
    this.cache.set(cacheKey, details)
    return details
  }
}
```

### Registry Configuration

```typescript
{
  dynamicDataSource: {
    enable: true,
    registry: {
      maxSize: 50,                    // Max datasources in pool
      idleTimeout: 30 * 60 * 1000    // 30 minutes
    }
  }
}
```

## Testing

When testing code that uses dynamic datasources:

1. **Mock the lookup** by implementing DataSourceLookup interface
2. **Register the mock** with
   `modelManager.setDataSourceLookup(name, mockLookup)`
3. **Create context** with test lookup keys
4. **Verify queries** execute on correct datasource

Example:

```typescript
const mockLookup: DataSourceLookup = {
  async lookup(dataSourceName, lookupKey) {
    return {
      type: 'mysql',
      config: { database: `test_${lookupKey}` },
    }
  },
}

modelManager.setDataSourceLookup('project', mockLookup)

const context = DataSourceContext.fromDataSources({
  project: { lookupKey: 'proj123' },
})

await repo.find({}, { context })
```

See [Testing](testing.md) for more details.

## Related Files

- **[src/data-source/context.ts](../src/data-source/context.ts)** -
  DataSourceContext implementation
- **[src/data-source-manager.ts](../src/data-source-manager.ts)** - Lookup
  registration and resolution
- **[src/model-manager.ts](../src/model-manager.ts)** - Public API delegation
- **[src/data-source/registry.ts](../src/data-source/registry.ts)** - Connection
  pool management
- **[src/data-source/index.ts](../src/data-source/index.ts)** - DataSourceLookup
  interface

## See Also

- [Multiple Dynamic DataSources](dynamic-datasource-multiple.md) - Using
  multiple datasources simultaneously
- [Dynamic DataSources - Advanced](dynamic-datasource-advanced.md) -
  BaseDataSourceLookup, DataSourceRegistry internals
- [Architecture](architecture.md) - Overall system design
- [Testing](testing.md) - Testing with dynamic datasources
- [Performance](performance.md) - Optimization strategies
