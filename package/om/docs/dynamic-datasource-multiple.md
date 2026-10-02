# Multiple Dynamic DataSources

## Overview

The dynamic datasource system supports using multiple datasources
simultaneously, each with its own context and isolation boundaries. This is
essential for multi-tenant applications, cross-boundary relations, and complex
data isolation scenarios.

## When to Use Multiple DataSources

### Single DataSource (Common Case)

When all entities share the same isolation boundary:

```typescript
// All repos use the same 'workspace' datasource
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
})

// Works for all repos configured with dataSource: 'workspace'
await repoSurvey.find(query, { context })
await repoQuestion.find(query, { context })
```

### Multiple DataSources (Advanced)

When entities have different isolation boundaries or span multiple tenancy
levels:

**Example**: Multi-level tenant isolation

- `survey` uses datasource 'workspace' (isolated by workspaceId)
- `organization` uses datasource 'tenant' (isolated by tenantId)
- `survey` has a relation to `organization`

```typescript
// Multi-datasource context
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  tenant: { lookupKey: tenantId },
})

// Survey repo uses 'workspace' context
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
  lookupKey?: string // Key for dynamic datasource lookup
  dataSourceKey?: string // Direct datasource connection key
  useDefault?: boolean // Use default datasource
}

// Map of datasource names to their context options
type DataSourceContextOptions = Record<string, DataSourceContextEntry>
```

### Factory Method

**`DataSourceContext.fromDataSources(options: DataSourceContextOptions)`**

Creates a multi-datasource context:

```typescript
DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  tenant: { lookupKey: tenantId },
  customer: { lookupKey: customerId },
})
```

### Direct Constructor

```typescript
// Alternative: direct constructor usage
new DataSourceContext({
  workspace: { lookupKey: 'workspace-123' },
  tenant: { lookupKey: 'tenant456' },
})
```

### Methods

**`getForDataSource(dataSourceName: string): DataSourceContextEntry | undefined`**

Gets the context for a specific datasource:

```typescript
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: 'ws1' },
  tenant: { lookupKey: 'tenant1' },
})

context.getForDataSource('workspace')
// Returns: { lookupKey: 'ws1' }

context.getForDataSource('tenant')
// Returns: { lookupKey: 'tenant1' }

context.getForDataSource('unknown')
// Returns: undefined (datasource not configured)
```

## How It Works

### Context Resolution

When a repository needs a datasource, the context resolves the appropriate
entry:

1. Repository calls `context.getForDataSource('dataSourceName')`
2. Context looks up the datasource by exact name match
3. Returns `DataSourceContextEntry` or `undefined` if not found
4. DataSourceLookup uses the entry to resolve the actual connection

### Example Flow

```typescript
// Service layer
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  customer: { lookupKey: customerId },
})

// Survey repo (dataSource: 'workspace')
await repoSurvey.findOne(
  { _id: surveyId },
  {
    context,
    populate: {
      questions: true, // Same datasource ('workspace')
      customer: true, // Different datasource ('customer')
    },
  }
)
```

**Resolution steps:**

1. `repoSurvey.getDataSource(context)`:
   - Calls `context.getForDataSource('workspace')`
   - Gets `{ lookupKey: workspaceId }`
   - Lookup resolves to actual connection

2. When populating `questions` relation:
   - `repoQuestion.getDataSource(context)`
   - Calls `context.getForDataSource('workspace')`
   - Uses same context (same datasource)

3. When populating `customer` relation:
   - `repoCustomer.getDataSource(context)`
   - Calls `context.getForDataSource('customer')`
   - Gets `{ lookupKey: customerId }`
   - Lookup resolves to different connection

### Internal Behaviour

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
      dataSource: 'workspace', // Used for context lookup
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

The `dataSource` property determines which entry in the context the repository
uses.

## Multi-Tenant Patterns

### Pattern 1: Hierarchical Tenancy

Organisations > Workspaces > Data

```typescript
const context = DataSourceContext.fromDataSources({
  org: { lookupKey: orgId }, // Organisation-level data
  workspace: { lookupKey: workspaceId }, // Workspace-level data
})

// Repos automatically use appropriate datasource
await repoOrganization.find({}, { context }) // Uses 'org'
await repoSurvey.find({}, { context }) // Uses 'workspace'
```

### Pattern 2: Cross-Tenant Relations

Data spans multiple tenant boundaries:

```typescript
// User in global datasource, documents in workspace datasource
const context = DataSourceContext.fromDataSources({
  global: { useDefault: true },
  workspace: { lookupKey: workspaceId },
})

await repoDocument.findOne(
  { _id: docId },
  {
    context,
    populate: {
      author: true, // Uses 'global' datasource
    },
  }
)
```

### Pattern 3: Shared Reference Data

Shared data (e.g., categories) plus isolated data:

```typescript
const context = DataSourceContext.fromDataSources({
  shared: { useDefault: true }, // Shared reference data
  customer: { lookupKey: customerId }, // Customer-isolated data
})

await repoProduct.findOne(
  { _id: productId },
  {
    context,
    populate: {
      category: true, // Uses 'shared' datasource
    },
  }
)
```

## Cross-DataSource Relations

Relations can span datasources without extra configuration at the query site:

```typescript
// Entity definitions
@Entity('surveys', { dataSource: 'workspace' })
class Survey {
  @ManyToOne(() => Organization, { dataSource: 'tenant' })
  organization: Ref<Organization>
}

@Entity('organizations', { dataSource: 'tenant' })
class Organization {
  @OneToMany(() => Survey, (survey) => survey.organization)
  surveys: Ref<Survey>[]
}

// Usage
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  tenant: { lookupKey: tenantId },
})

// Populate across datasources
const survey = await repoSurvey.findOne(
  { _id: surveyId },
  {
    context,
    populate: { organization: true },
  }
)
```

The framework automatically routes each entity to its configured datasource.

## Migration from Single to Multiple DataSources

### Before (Single DataSource)

```typescript
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
})

await repoSurvey.find(query, { context })
```

### After (Multiple DataSources)

Simply add additional datasource entries:

```typescript
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  tenant: { lookupKey: tenantId },
  global: { useDefault: true },
})

// Same query works, automatically uses appropriate datasources
await repoSurvey.find(query, { context })
```

All repositories continue working with the same API: they automatically use the
datasource entry matching their configured `dataSource` name.

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
  workspace: { lookupKey: workspaceId }, // Add this
})
```

### DataSourceLookup Not Configured

**Error:**

```
Error: No DataSourceLookup configured for datasource "workspace".
Available datasources: tenant, customer
```

**Cause:** ModelManager doesn't have lookup registered for datasource

**Solution:** Register the lookup:

```typescript
modelManager.setDataSourceLookup('workspace', workspaceLookup)
```

### Undefined Lookup Key

**Error:**

```
Error: DataSourceLookup for "workspace" returned undefined for key: undefined
```

**Cause:** Context has `lookupKey: undefined`

**Solution:** Ensure valid lookup key:

```typescript
if (!workspaceId) throw new Error('Workspace ID required')

const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
})
```

## Best Practices

### 1. Explicit Context Creation

Always create context with all required datasources:

```typescript
// Good: explicit and clear
const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  tenant: { lookupKey: tenantId },
})
```

### 2. Validate Lookup Keys

Validate keys before creating context:

```typescript
if (!workspaceId || !tenantId) {
  throw new Error('Required tenant identifiers missing')
}

const context = DataSourceContext.fromDataSources({
  workspace: { lookupKey: workspaceId },
  tenant: { lookupKey: tenantId },
})
```

### 3. Consistent Naming

Use consistent datasource names across repositories:

```typescript
// All workspace-scoped repos use 'workspace'
class RepoSurvey extends Repo<Survey> {
  constructor() {
    super({ name: 'survey', dataSource: 'workspace' })
  }
}

class RepoQuestion extends Repo<Question> {
  constructor() {
    super({ name: 'question', dataSource: 'workspace' })
  }
}
```

### 4. Document DataSource Boundaries

Clearly document which entities belong to which datasource:

```typescript
/**
 * Workspace-scoped repositories (dataSource: 'workspace')
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
registry.register('workspace', {
  type: 'postgres',
  host: 'localhost',
  database: 'workspace_db',
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
class CachedWorkspaceLookup extends BaseDataSourceLookup {
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

See [dynamic-datasource-advanced.md](./dynamic-datasource-advanced.md) for
advanced caching patterns.

## See Also

- [Dynamic DataSource Basics](./dynamic-datasource.md) - Core concepts and
  single datasource usage
- [Advanced Infrastructure](./dynamic-datasource-advanced.md) -
  BaseDataSourceLookup, DataSourceRegistry, caching
- [Relations](./relations.md) - Relationship mapping and population
- [Testing](./testing.md) - Testing strategies for multi-datasource scenarios
