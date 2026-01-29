# Mzen Agent Documentation

This document provides context for AI agents working on the mzen project,
particularly regarding the relation system and composite key implementation.

## Relation System Overview

Mzen uses a sophisticated relation system for joining data across repositories.
The system supports various relation types similar to ORMs:

- `belongsToOne` - A document belongs to a single related document
- `belongsToMany` - A document belongs to multiple related documents (array of
  IDs)
- `hasOne` - A document has one related document
- `hasMany` - A document has many related documents
- `hasManyCount` - Returns count of related documents instead of the documents
  themselves

## Architecture

### Core Files

- **[mzen/src/repo-populator.ts](mzen/src/repo-populator.ts)** - Main
  orchestrator for populating relations
- **[mzen/src/repo-populator/relation/abstract.ts](mzen/src/repo-populator/relation/abstract.ts)** -
  Base class with shared logic
- **[mzen/src/repo-populator/relation/has-abstract.ts](mzen/src/repo-populator/relation/has-abstract.ts)** -
  Base for `hasOne`, `hasMany` relations
- **[mzen/src/repo-populator/relation/belongs-to-abstract.ts](mzen/src/repo-populator/relation/belongs-to-abstract.ts)** -
  Base for `belongsToOne`, `belongsToMany` relations

### Class Hierarchy

```
RelationAbstract (base)
  ├── RelationHasAbstract
  │   ├── RelationHasOne
  │   ├── RelationHasMany
  │   └── RelationHasManyCount
  └── RelationBelongsToAbstract
      ├── RelationBelongsToOne
      └── RelationBelongsToMany
```

## Composite Keys Implementation

### The Problem

Originally, relations could only join on a single field. For example:

```typescript
relations: {
  participant: {
    type: 'belongsToOne',
    repo: 'surveyParticipant',
    key: 'participantId',  // Can only match on this one field
  }
}
```

This was insufficient for multi-tenant scenarios where you need to match on
multiple fields (e.g., `participantId` + `surveyId` + `projectId`).

### The Solution: Unified Composite Keys

We implemented a **unified approach** where all joins are treated as composite
key operations. Single-key joins are just composite keys with one field.

#### Configuration

```typescript
relations: {
  participant: {
    type: 'belongsToOne',
    repo: 'surveyParticipant',
    key: 'participantId',      // Legacy: still supported
    keys: {                     // NEW: Composite keys
      surveyId: 'surveyId',     // source field -> target field
      projectId: 'projectId'    // must match both
    }
  }
}
```

The `key` property is automatically merged with `keys` for backward
compatibility.

### How It Works

#### 1. Key Normalization (`getNormalizedKeys`)

Converts legacy `key`/`pkey` and new `keys` into a unified format:

```typescript
// Input: { key: 'participantId', keys: { surveyId: 'surveyId' } }
// Output: { participantId: '_id', surveyId: 'surveyId' }
```

For `belongsTo` relations: `key` is source field → `pkey` is target field For
`has` relations: `pkey` is source field → `key` is target field

#### 2. Composite ID Extraction (`getCompositeRelationIds`)

Extracts field values from source documents:

```typescript
// Source docs: [{ participantId: 'p1', surveyId: 's1', projectId: 'proj1' }]
// Output: [{ participantId: 'p1', surveyId: 's1', projectId: 'proj1' }]
```

Handles special cases:

- Arrays for `belongsToMany` (e.g., `favouriteColorIds: ['1', '5']`)
- Missing fields (skipped from output)

#### 3. Query Building

**Single Key (Optimized):**

```javascript
// Uses $in for better performance
{
  _id: {
    $in: ['p1', 'p2']
  }
}
```

**Multiple Keys:**

```javascript
// Uses $or with compound conditions
{
  $or: [
    { participantId: 'p1', surveyId: 's1', projectId: 'proj1' },
    { participantId: 'p2', surveyId: 's2', projectId: 'proj2' },
  ]
}
```

#### 4. Result Grouping (`createCompositeKey`)

Groups results using composite key strings:

```typescript
// Single key: "p1"
// Multiple keys: "p1||s1||proj1"
```

This allows efficient lookup during population.

#### 5. Population

The `populateValues` method:

1. Creates composite keys from source documents
2. Looks up related documents using those keys
3. Handles special cases:
   - `belongsToMany` with array source keys
   - `hasOne` vs `hasMany` (single doc vs array)
   - Empty results (undefined for `*One`, empty array for `*Many`)

### Key Design Decisions

1. **Unified Implementation**: No separate code paths for single vs composite
   keys

   - Simpler maintenance
   - Consistent behavior
   - Easier testing

2. **Backward Compatibility**: All existing single-key relations work unchanged

   - `key` property still supported
   - Automatically converted to `keys` format internally

3. **Query Optimization**:

   - **Single-key queries** use `$in` (faster)
   - **Constant field detection**: Analyzes composite IDs to identify fields
     with constant values
   - **Optimized multi-key queries**: Minimizes `$or` clauses by using `$in` for
     variant fields
   - See "Query Optimization" section below for details

4. **Field Direction Mapping**:
   - Keys map `sourceField: targetField`
   - For `belongsTo`: source is current repo, target is related repo
   - For `has`: source is parent (related) repo, target is current repo

### Query Optimization for Composite Keys

The system automatically optimizes queries for composite keys by detecting which
fields are constant vs variant across documents.

#### Scenario 1: All but one field is constant

**Input documents:**

```javascript
;[
  { participantId: 'p1', surveyId: 's1', projectId: 'proj1' },
  { participantId: 'p2', surveyId: 's1', projectId: 'proj1' },
  { participantId: 'p3', surveyId: 's1', projectId: 'proj1' },
]
```

**Unoptimized query (3 $or clauses):**

```javascript
{
  $or: [
    { _id: 'p1', surveyId: 's1', projectId: 'proj1' },
    { _id: 'p2', surveyId: 's1', projectId: 'proj1' },
    { _id: 'p3', surveyId: 's1', projectId: 'proj1' },
  ]
}
```

**Optimized query (constants + $in):**

```javascript
{
  surveyId: 's1',         // Constant field (simple equality)
  projectId: 'proj1',     // Constant field (simple equality)
  _id: { $in: ['p1', 'p2', 'p3'] }  // Variant field ($in)
}
```

**Benefit:** 1 query instead of 3 $or clauses, more efficient for MongoDB.

#### Scenario 2: Multiple variant fields with grouping

**Input documents:**

```javascript
;[
  // Group 1: regionId='r1'
  { userId: 'u1', accountId: 'a1', regionId: 'r1' },
  { userId: 'u2', accountId: 'a2', regionId: 'r1' },
  // Group 2: regionId='r2'
  { userId: 'u3', accountId: 'a3', regionId: 'r2' },
]
```

**Optimized query (grouped by constant):**

```javascript
{
  $or: [
    {
      regionId: 'r1', // Constant in this group
      userId: { $in: ['u1', 'u2'] },
      accountId: { $in: ['a1', 'a2'] },
    },
    {
      regionId: 'r2', // Different constant
      userId: 'u3',
      accountId: 'a3',
    },
  ]
}
```

**Benefit:** 2 $or clauses instead of 3, with $in for variants within each
group.

#### How It Works

The optimization is handled by `buildOptimizedCompositeQuery()` in
[abstract.ts](mzen/src/repo-populator/relation/abstract.ts):

1. **Analyze fields** (`analyzeCompositeFields`):

   - Detect which fields have the same value across all documents (constant)
   - Detect which fields have varying values (variant)
   - Skip array values (always treat as variant)

2. **Build optimized query**:

   - Add constant fields as simple equality: `{ field: value }`
   - If only one variant field, use `$in`: `{ field: { $in: [values] } }`
   - If multiple variant fields, group by constants and use `$or` with `$in`
     within groups

3. **Fallback for worst case**:
   - When all fields vary, falls back to full `$or` with individual conditions
   - Still better than naive approach because of de-duplication

### Example Use Cases

#### Multi-Tenant Participant Matching

```typescript
// Survey response has: participantId, surveyId, projectId
// Need to find participant where ALL fields match

relations: {
  participant: {
    type: 'belongsToOne',
    repo: 'surveyParticipant',
    key: 'participantId',
    keys: {
      surveyId: 'surveyId',
      projectId: 'projectId'
    }
  }
}

// This will only match surveyParticipant records where:
// - _id === participantId (from key)
// - surveyId === surveyId (from keys)
// - projectId === projectId (from keys)
```

#### Triple Composite Key

```typescript
relations: {
  account: {
    type: 'belongsToOne',
    repo: 'account',
    keys: {
      userId: 'userId',
      accountId: 'accountId',
      regionId: 'regionId'
    }
  }
}
```

## Testing

### Test Coverage

All relation types have comprehensive test coverage:

- **Backward compatibility tests** - Ensure existing single-key relations work
- **Composite key tests** - Verify multi-column joins work correctly
- **Edge case tests** - No matches, missing fields, array handling

### Test Files

- `src/repo-populator/relation/_tests/*.test.ts` - All relation type tests
- `src/repo-populator/relation/_tests/composite-keys.test.ts` - Composite key
  specific tests
- `src/repo-populator/relation/_tests/composite-keys-optimization.test.ts` -
  Query optimization tests

### MockDataSource

The mock data source was extended to support `$or` queries, which are required
for composite key matching. See
[mzen/src/data-source/mock.ts](mzen/src/data-source/mock.ts) for implementation
details.

## Common Patterns

### When to Use Composite Keys

Use composite keys when:

- Multi-tenant applications need to scope relations by
  tenant/project/organization
- Sharded data requires matching on multiple dimensions
- Natural keys involve multiple fields
- You need to ensure relations match on business rules (e.g., same survey, same
  project)

### When NOT to Use Composite Keys

Stick with single keys when:

- Simple ID-based lookups are sufficient
- Data is not multi-tenant
- Performance is critical (single-key `$in` queries are faster)

## Performance Considerations

### Database Indexes

For composite key relations, create compound indexes on the matching fields:

```javascript
// MongoDB example
db.surveyParticipant.createIndex({
  surveyId: 1,
  projectId: 1,
  _id: 1,
})
```

### Query Optimization

The system automatically optimizes queries to minimize the number of `$or`
clauses:

- **Single-key queries** use `$in` operator (most optimal)
- **Constant field detection** analyzes documents to identify fields with the
  same value
- **Optimized multi-key queries** use simple equality for constant fields and
  `$in` for variant fields
- **Grouped `$or` queries** when multiple variant fields exist, groups by
  constant values

**Example optimization:**

- 100 documents with same `projectId` and `surveyId`, varying `participantId`
- Unoptimized: 100 `$or` clauses
- Optimized: 2 constant equality conditions + 1 `$in` with 100 values

**Best practices:**

- Create compound indexes covering constant fields first, then variant fields
- Order: `{ constantField1: 1, constantField2: 1, variantField: 1 }`
- MongoDB query planner uses indexes efficiently with this approach

### Composite Key String Format

Composite keys are concatenated with `||` delimiter:

- Single key: `"value1"`
- Multiple keys: `"value1||value2||value3"`
- Undefined values: `"value1||__undefined__||value3"` (skipped in practice)

This format is for internal grouping only and not exposed to users.

## Debugging Tips

### Enable Query Logging

To see what queries are being generated, you can add logging in:

- [has-abstract.ts](mzen/src/repo-populator/relation/has-abstract.ts) - Line ~40
- [belongs-to-abstract.ts](mzen/src/repo-populator/relation/belongs-to-abstract.ts) -
  Line ~54

```typescript
console.log('Query:', JSON.stringify(config.query))
console.log('Related docs:', relatedDocs)
```

### Common Issues

1. **No results returned**

   - Check that all composite key fields exist in both source and target
     documents
   - Verify field names match exactly (case-sensitive)
   - Ensure data types match (strings vs numbers)

2. **Wrong results returned**

   - Verify the field direction mapping (source → target)
   - Check if `key` and `keys` are being merged correctly
   - Look at the generated query to ensure it matches expectations

3. **Performance issues**
   - Ensure compound indexes exist on target collection
   - Consider if single-key relation would suffice
   - Check number of `$or` conditions being generated

## Future Enhancements

Potential areas for future work:

1. **Embedded Relations**: Currently composite keys work with regular relations.
   Embedded relations may need similar support.

2. **BelongsToMany with Composite Keys**: Currently `belongsToMany` handles
   array source keys but not in combination with composite keys.

3. **Performance Monitoring**: Add metrics to track query performance with
   composite keys.

4. **Query Optimization**: Explore alternative query strategies for large result
   sets.

## Related Documentation

- [Implementation Plan](composite-keys-implementation-plan.tmp.md) - Detailed
  technical design
- [Repo Populator Tests](mzen/src/repo-populator/relation/_tests/) - Test
  examples
- [RelationConfig Interface](mzen/src/repo-populator.ts#L16-L31) - Configuration
  options

## Questions?

When working on relation-related features, consider:

1. Does this change affect backward compatibility?
2. Do existing tests still pass?
3. Are composite keys handled correctly?
4. Is the field direction mapping correct for the relation type?
5. Are edge cases (empty results, missing fields) handled?

This system is battle-tested with 30+ passing tests covering all relation types
and composite key scenarios.

## Multi-DataSource Context System

### Overview

The DataSourceContext system enables dynamic datasource routing at runtime. This is essential for multi-tenant architectures where different entities route to different databases based on request context.

### Core Concepts

**DataSourceContext** - Carries routing information for dynamic datasource resolution. Flows from request → service → repo → datasource.

**DataSourceLookup** - Interface for resolving datasource connection details based on a lookup key (e.g., projectId, tenantId).

**DataSourceRegistry** - Manages a pool of dynamically-created datasource instances with LRU eviction and health checks.

### API

#### Creating Contexts

All contexts must explicitly specify datasource names:

```typescript
// Single datasource
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }
})

// Multiple datasources
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId }
})
```

#### Configuring Lookups

Each datasource must have a registered lookup implementation:

```typescript
// Configure lookup for 'project' datasource
modelManager.setDataSourceLookup('project', projectLookup)

// Configure lookup for 'tenant' datasource
modelManager.setDataSourceLookup('tenant', tenantLookup)
```

#### DataSourceLookup Interface

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

### Resolution Flow

1. **Service creates context** with explicit datasource names and lookup keys
2. **Repo receives context** in query options
3. **Repo resolves datasource** by calling `getDataSource(context)`
4. **DataSourceManager gets entry** from context for repo's configured datasource name
5. **DataSourceManager checks lookup** registry for that datasource name
6. **If lookup exists**, calls `lookup(dataSourceName, lookupKey)` to get connection details
7. **DataSourceRegistry** creates or reuses connection pool for that specific database
8. **Query executes** on the resolved datasource

### Error Handling

**Missing Lookup Configuration:**
```
Error: No DataSourceLookup configured for datasource "project".
Available datasources: tenant, customer
```

**Solution:** Register the lookup:
```typescript
modelManager.setDataSourceLookup('project', lookup)
```

**Missing Context:**
```
Error: No datasource context provided for dynamic repo: survey.
Provide context with lookupKey or dataSourceKey in query options.
```

**Solution:** Create and pass context:
```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }
})
await repo.find(query, { context })
```

### Repository Configuration

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

### Design Decisions

1. **Explicit Datasource Names** - All contexts require explicit datasource names (no wildcard fallback)
   - Rationale: Clear intent, easier debugging, prevents accidental misrouting

2. **Per-Datasource Lookup Registration** - Each datasource has its own lookup implementation
   - Rationale: Supports future scenarios with multiple dynamic datasources (e.g., project + tenant)

3. **Map-Based Lookup Storage** - `dataSourceLookups: Map<string, DataSourceLookup>`
   - Rationale: O(1) lookup, clear separation, easy to extend

4. **Error Messages Include Available Datasources** - When lookup missing, shows what's configured
   - Rationale: Helps developers quickly identify configuration issues

### Testing

When testing code that uses dynamic datasources:

1. **Mock the lookup** by implementing DataSourceLookup interface
2. **Register the mock** with `modelManager.setDataSourceLookup(name, mockLookup)`
3. **Create context** with test lookup keys
4. **Verify queries** execute on correct datasource

Example:
```typescript
const mockLookup: DataSourceLookup = {
  async lookup(dataSourceName, lookupKey) {
    return {
      type: 'mysql',
      config: { database: `test_${lookupKey}` }
    }
  }
}

modelManager.setDataSourceLookup('project', mockLookup)

const context = DataSourceContext.fromDataSources({
  project: { lookupKey: 'proj123' }
})

await repo.find({}, { context })
```

### Common Patterns

**Service Layer:**
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

**Cross-Datasource Relations:**
```typescript
// Survey (project datasource) has relation to Tenant (tenant datasource)
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId },
  tenant: { lookupKey: tenantId }
})

await repoSurvey.findOne(surveyId, {
  context,
  populate: {
    tenant: true // Automatically uses 'tenant' context
  }
})
```

**Transactions:**
```typescript
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: projectId }
})

const repo = this.getRepo('survey')
const dataSource = await repo.getDataSource(context)

try {
  await dataSource.transactionStart()
  await repo.deleteOne({ _id: surveyId }, { context })
  await dataSource.transactionCommit()
} catch (error) {
  await dataSource.transactionRollback()
  throw error
}
```

### Performance Considerations

**Connection Pooling:**
- Each resolved datasource maintains its own connection pool
- Registry uses LRU eviction (default: 50 datasources)
- Idle timeout: 30 minutes (configurable)
- Health checks every 5 minutes (configurable)

**Lookup Caching:**
- Implement caching in your DataSourceLookup implementation
- Avoids repeated database queries for same lookup key
- Example: 10-minute TTL cache for project configurations

**Registry Configuration:**
```typescript
{
  enableDynamicDataSources: true,
  dataSourceRegistryConfig: {
    maxSize: 50,                    // Max datasources in pool
    idleTimeout: 30 * 60 * 1000,   // 30 minutes
    healthCheckInterval: 5 * 60 * 1000  // 5 minutes
  }
}
```

### Related Files

- **[src/data-source/context.ts](src/data-source/context.ts)** - DataSourceContext implementation
- **[src/data-source-manager.ts](src/data-source-manager.ts)** - Lookup registration and resolution
- **[src/model-manager.ts](src/model-manager.ts)** - Public API delegation
- **[src/data-source/registry.ts](src/data-source/registry.ts)** - Connection pool management
- **[src/data-source/index.ts](src/data-source/index.ts)** - DataSourceLookup interface
