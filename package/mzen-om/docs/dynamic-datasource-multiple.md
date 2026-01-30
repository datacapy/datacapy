# Multiple Dynamic DataSources

## Overview

The dynamic datasource system supports using multiple datasources simultaneously, each with its own context and isolation boundaries. This is essential for multi-tenant applications, cross-boundary relations, and complex data isolation scenarios.

## When to Use Multiple DataSources

### Single DataSource (Common Case)
When all entities share the same isolation boundary:

```typescript
// All repos use the same 'project' datasource
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }
})

// Works for all repos configured with dataSource: 'project'
await repoSurvey.find(query, { context })
await repoQuestion.find(query, { context })
```

### Multiple DataSources (Advanced)
When entities have different isolation boundaries or span multiple tenancy levels:

**Example**: Multi-level tenant isolation
- `survey` uses datasource 'project' (isolated by projectId)
- `organization` uses datasource 'tenant' (isolated by tenantId)
- `survey` has a relation to `organization`

```typescript
// Multi-datasource context
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})

// Survey repo uses 'project' context
// Organization repo (when populated) uses 'tenant' context
await repoSurvey.findOne(
  { _id: surveyId },
  {
    context,
    populate: {
      organization: true, // Automatically uses 'tenant' context
    },
  }
)
```

## API Reference

### Type Definitions

```typescript
// Context options for a specific datasource
interface DataSourceContextEntry {
  lookupKey?: string      // Key for dynamic datasource lookup
  dataSourceKey?: string  // Direct datasource connection key
  useDefault?: boolean    // Use default datasource
}

// Map of datasource names to their context options
type DataSourceContextOptions = Record<string, DataSourceContextEntry>
```

### Factory Method

**`DataSourceContext.fromDataSources(options: DataSourceContextOptions)`**

Creates a multi-datasource context:

```typescript
DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
  customer: { lookupKey: customerId },
})
```

### Direct Constructor

```typescript
// Alternative: direct constructor usage
new DataSourceContext({
  project: { lookupKey: 'project123' },
  tenant: { lookupKey: 'tenant456' },
})
```

### Methods

**`getForDataSource(dataSourceName: string): DataSourceContextEntry | undefined`**

Gets the context for a specific datasource:

```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: 'proj1' },
  tenant: { lookupKey: 'tenant1' },
})

context.getForDataSource('project')
// Returns: { lookupKey: 'proj1' }

context.getForDataSource('tenant')
// Returns: { lookupKey: 'tenant1' }

context.getForDataSource('unknown')
// Returns: undefined (datasource not configured)
```

## How It Works

### Context Resolution

When a repository needs a datasource, the context resolves the appropriate entry:

1. Repository calls `context.getForDataSource('dataSourceName')`
2. Context looks up the datasource by exact name match
3. Returns `DataSourceContextEntry` or `undefined` if not found
4. DataSourceLookup uses the entry to resolve the actual connection

### Example Flow

```typescript
// Service layer
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  account: { lookupKey: accountId },
})

// Survey repo (dataSource: 'project')
await repoSurvey.findOne(
  { _id: surveyId },
  {
    context,
    populate: {
      questions: true, // Same datasource ('project')
      account: true,   // Different datasource ('account')
    }
  }
)
```

**Resolution steps:**
1. `repoSurvey.getDataSource(context)`:
   - Calls `context.getForDataSource('project')`
   - Gets `{ lookupKey: projectId }`
   - Lookup resolves to actual connection

2. When populating `questions` relation:
   - `repoQuestion.getDataSource(context)`
   - Calls `context.getForDataSource('project')`
   - Uses same context (same datasource)

3. When populating `account` relation:
   - `repoAccount.getDataSource(context)`
   - Calls `context.getForDataSource('account')`
   - Gets `{ lookupKey: accountId }`
   - Lookup resolves to different connection

### Internal Behavior

- Context stores datasource entries in an internal Map
- `getForDataSource(name)` performs exact string match lookup
- Returns `undefined` if datasource name not found in context
- No fallback or wildcard matching

## Repository Configuration

Repositories specify their datasource name during configuration:

```typescript
export class RepoSurvey extends Repo<Survey> {
  constructor() {
    super({
      name: 'survey',
      dataSource: 'project', // Used for context lookup
    })
  }
}

export class RepoOrganization extends Repo<Organization> {
  constructor() {
    super({
      name: 'organization',
      dataSource: 'tenant', // Different datasource
    })
  }
}
```

The `dataSource` property determines which entry in the context the repository uses.

## Multi-Tenant Patterns

### Pattern 1: Hierarchical Tenancy

Organizations > Projects > Data

```typescript
const context = DataSourceContext.fromDataSources({
  org: { lookupKey: orgId },       // Organization-level data
  project: { lookupKey: projectId }, // Project-level data
})

// Repos automatically use appropriate datasource
await repoOrganization.find({}, { context }) // Uses 'org'
await repoSurvey.find({}, { context })        // Uses 'project'
```

### Pattern 2: Cross-Tenant Relations

Data spans multiple tenant boundaries:

```typescript
// User in global datasource, documents in project datasource
const context = DataSourceContext.fromDataSources({
  global: { useDefault: true },
  project: { lookupKey: projectId },
})

await repoDocument.findOne(
  { _id: docId },
  {
    context,
    populate: {
      author: true, // Uses 'global' datasource
    }
  }
)
```

### Pattern 3: Shared Reference Data

Shared data (e.g., categories) plus isolated data:

```typescript
const context = DataSourceContext.fromDataSources({
  shared: { useDefault: true },     // Shared reference data
  customer: { lookupKey: customerId }, // Customer-isolated data
})

await repoProduct.findOne(
  { _id: productId },
  {
    context,
    populate: {
      category: true, // Uses 'shared' datasource
    }
  }
)
```

## Cross-DataSource Relations

Relations can span datasources seamlessly:

```typescript
// Entity definitions
@Entity('surveys', { dataSource: 'project' })
class Survey {
  @ManyToOne(() => Organization, { dataSource: 'tenant' })
  organization: Ref<Organization>
}

@Entity('organizations', { dataSource: 'tenant' })
class Organization {
  @OneToMany(() => Survey, survey => survey.organization)
  surveys: Ref<Survey>[]
}

// Usage
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})

// Populate across datasources
const survey = await repoSurvey.findOne(
  { _id: surveyId },
  {
    context,
    populate: { organization: true }
  }
)
```

The framework automatically routes each entity to its configured datasource.

## Migration from Single to Multiple DataSources

### Before (Single DataSource)

```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }
})

await repoSurvey.find(query, { context })
```

### After (Multiple DataSources)

Simply add additional datasource entries:

```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
  global: { useDefault: true },
})

// Same query works, automatically uses appropriate datasources
await repoSurvey.find(query, { context })
```

All repositories continue working with the same API—they automatically use the datasource entry matching their configured `dataSource` name.

## Error Handling

### Missing DataSource Context

**Error:**
```
Error: No datasource context provided for dynamic repo: survey.
Provide context with lookupKey or dataSourceKey in query options.
```

**Cause:** Context doesn't include entry for repository's datasource

**Solution:** Add datasource to context:
```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }, // Add this
})
```

### DataSourceLookup Not Configured

**Error:**
```
Error: No DataSourceLookup configured for datasource "project".
Available datasources: tenant, customer
```

**Cause:** ModelManager doesn't have lookup registered for datasource

**Solution:** Register the lookup:
```typescript
modelManager.setDataSourceLookup('project', projectLookup)
```

### Undefined Lookup Key

**Error:**
```
Error: DataSourceLookup for "project" returned undefined for key: undefined
```

**Cause:** Context has `lookupKey: undefined`

**Solution:** Ensure valid lookup key:
```typescript
if (!projectId) throw new Error('Project ID required')

const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }
})
```

## Best Practices

### 1. Explicit Context Creation

Always create context with all required datasources:

```typescript
// Good: explicit and clear
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})
```

### 2. Validate Lookup Keys

Validate keys before creating context:

```typescript
if (!projectId || !tenantId) {
  throw new Error('Required tenant identifiers missing')
}

const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId },
})
```

### 3. Consistent Naming

Use consistent datasource names across repositories:

```typescript
// All project-scoped repos use 'project'
class RepoSurvey extends Repo<Survey> {
  constructor() {
    super({ name: 'survey', dataSource: 'project' })
  }
}

class RepoQuestion extends Repo<Question> {
  constructor() {
    super({ name: 'question', dataSource: 'project' })
  }
}
```

### 4. Document DataSource Boundaries

Clearly document which entities belong to which datasource:

```typescript
/**
 * Project-scoped repositories (dataSource: 'project')
 * - Survey
 * - Question
 * - Response
 *
 * Tenant-scoped repositories (dataSource: 'tenant')
 * - Organization
 * - User
 */
```

## Performance Considerations

### Connection Pooling

Each datasource maintains its own connection pool. Configure appropriately:

```typescript
registry.register('project', {
  type: 'postgres',
  host: 'localhost',
  database: 'project_db',
  poolSize: 20, // Per-datasource pool
})

registry.register('tenant', {
  type: 'postgres',
  host: 'localhost',
  database: 'tenant_db',
  poolSize: 10,
})
```

### Caching Strategy

Consider caching at the lookup level:

```typescript
class CachedProjectLookup extends BaseDataSourceLookup {
  private cache = new Map<string, string>()

  async lookup(lookupKey: string): Promise<string | undefined> {
    if (this.cache.has(lookupKey)) {
      return this.cache.get(lookupKey)
    }

    const result = await this.fetchDataSourceKey(lookupKey)
    if (result) this.cache.set(lookupKey, result)
    return result
  }
}
```

See [dynamic-datasource-advanced.md](./dynamic-datasource-advanced.md) for advanced caching patterns.

## See Also

- [Dynamic DataSource Basics](./dynamic-datasource.md) - Core concepts and single datasource usage
- [Advanced Infrastructure](./dynamic-datasource-advanced.md) - BaseDataSourceLookup, DataSourceRegistry, caching
- [Relations](./relations.md) - Relationship mapping and population
- [Testing](./testing.md) - Testing strategies for multi-datasource scenarios
