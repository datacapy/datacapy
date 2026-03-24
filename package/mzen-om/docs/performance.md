# Performance

## Database Indexing

Proper indexing is critical for query performance, especially with composite keys.

### Composite Key Indexes

For composite key relations, create compound indexes on the matching fields:

```javascript
// MongoDB example
db.surveyParticipant.createIndex({
  surveyId: 1,
  projectId: 1,
  _id: 1,
})
```

### Index Ordering

Order indexes with constant fields first, then variant fields:

```javascript
// Optimal for queries where projectId and surveyId are constant
db.responses.createIndex({
  projectId: 1,      // Constant field
  surveyId: 1,       // Constant field
  participantId: 1   // Variant field
})
```

This ordering allows MongoDB's query planner to efficiently use the index with the optimized composite queries.

### Index Best Practices

1. **Cover all composite key fields** - Include all fields used in composite key matching
2. **Order by selectivity** - Most selective (unique) fields first
3. **Monitor query performance** - Use database explain plans to verify index usage
4. **Avoid over-indexing** - Each index has storage and write overhead

## Query Optimization

### Single-Key Queries

Single-key queries use the `$in` operator, which is the most optimal:

```javascript
{
  _id: { $in: ['p1', 'p2', 'p3'] }
}
```

**Performance:** O(log n) with proper index

### Composite Key Optimization

The system automatically optimizes composite key queries by detecting constant vs variant fields:

**Example:**
- 100 documents with same `projectId` and `surveyId`, varying `participantId`
- **Unoptimized:** 100 `$or` clauses
- **Optimized:** 2 constant equality conditions + 1 `$in` with 100 values

**Optimized query:**

```javascript
{
  projectId: 'proj1',                    // Constant
  surveyId: 's1',                        // Constant
  participantId: { $in: [/* 100 IDs */] }  // Variant
}
```

See [Composite Keys](composite-keys.md) for detailed optimization strategies.

### Relation Population

The relation system includes query optimizations:

1. **Batching** - Minimizes database round-trips
2. **Deduplication** - Removes duplicate IDs before querying
3. **Single-key $in** - Uses efficient $in operator when possible
4. **Constant field detection** - Reduces $or clauses for composite keys

## Connection Pooling

### Static Datasources

Configure connection pools in your datasource config:

```typescript
{
  type: 'mongodb',
  config: {
    uri: 'mongodb://localhost:27017',
    database: 'myapp',
    poolSize: 10,          // Default pool size
    maxPoolSize: 50,       // Maximum connections
    minPoolSize: 5         // Minimum connections
  }
}
```

### Dynamic Datasources

The DataSourceRegistry manages connection pools for dynamically-created datasources:

```typescript
{
  dynamicDataSource: {
    enable: true,
    registry: {
      maxSize: 50,                    // Max datasources in pool
      idleTimeout: 30 * 60 * 1000,   // 30 minutes
      healthCheckInterval: 5 * 60 * 1000  // 5 minutes
    }
  }
}
```

**Features:**
- **LRU Eviction** - Least recently used datasources are removed when pool is full
- **Idle Timeout** - Connections close after 30 minutes of inactivity
- **Health Checks** - Verify connections every 5 minutes
- **Per-Datasource Pools** - Each datasource maintains its own connection pool

## Lookup Caching

Implement caching in your DataSourceLookup to avoid repeated database queries:

```typescript
class CachedProjectLookup implements DataSourceLookup {
  private cache = new LRUCache<string, DataSourceDetails>({
    max: 100,
    ttl: 10 * 60 * 1000  // 10 minutes
  })

  async lookup(dataSourceName: string, lookupKey: string) {
    const cacheKey = `${dataSourceName}:${lookupKey}`
    let details = this.cache.get(cacheKey)

    if (!details) {
      details = await this.fetchFromDatabase(lookupKey)
      this.cache.set(cacheKey, details)
    }

    return details
  }

  private async fetchFromDatabase(lookupKey: string) {
    // Fetch project configuration from database
    const project = await db.projects.findOne({ _id: lookupKey })
    return {
      type: 'mongodb',
      config: {
        uri: project.databaseUri,
        database: project.databaseName
      }
    }
  }
}
```

**Benefits:**
- Reduces database queries for lookup configurations
- Improves response times
- Reduces load on configuration database

**Considerations:**
- Set appropriate TTL based on configuration change frequency
- Implement cache invalidation if configurations change
- Monitor cache hit/miss rates

## Query Performance Monitoring

### Enable Query Logging

Add logging to track query performance:

```typescript
// In has-abstract.ts or belongs-to-abstract.ts
console.log('Query:', JSON.stringify(config.query))
console.time('relation-query')
const relatedDocs = await repo.find(config.query)
console.timeEnd('relation-query')
console.log('Results:', relatedDocs.length)
```

### Database Profiling

Use database-specific profiling tools:

**MongoDB:**
```javascript
// Enable profiling
db.setProfilingLevel(2)

// View slow queries
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 })
```

**MySQL:**
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;

-- View slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC;
```

## Performance Checklist

When optimizing performance:

1. ✓ **Indexes exist** for all composite key fields
2. ✓ **Index ordering** matches query patterns (constants first)
3. ✓ **Connection pooling** is properly configured
4. ✓ **Lookup caching** is implemented for dynamic datasources
5. ✓ **Query logging** is enabled during development
6. ✓ **Database profiling** is used to identify slow queries
7. ✓ **Batch operations** are used where possible
8. ✓ **Result limits** are applied to prevent large result sets

## Common Performance Issues

### Issue: Slow Composite Key Queries

**Symptoms:** Queries with multiple composite keys are slow

**Solutions:**
1. Verify compound index exists on target collection
2. Check index includes all composite key fields
3. Verify constant field detection is working (check generated query)
4. Consider if single-key relation would suffice

### Issue: Too Many Database Connections

**Symptoms:** Connection pool exhaustion errors

**Solutions:**
1. Increase `maxPoolSize` in datasource config
2. Reduce `maxSize` in registry config (fewer dynamic datasources)
3. Decrease `idleTimeout` to close idle connections faster
4. Implement connection pooling at application level

### Issue: Slow Datasource Resolution

**Symptoms:** First query to a project is slow

**Solutions:**
1. Implement lookup caching
2. Pre-warm frequently accessed datasources
3. Increase cache TTL for stable configurations
4. Consider static datasources for high-traffic projects

## See Also

- [Composite Keys](composite-keys.md) - Query optimization strategies
- [MySQL Indexes](mysql-indexes.md) - Generated columns and case-insensitive search indexes
- [DataSource Context](dynamic-datasource.md) - Connection pooling and registry
- [Debugging](debugging.md) - Troubleshooting performance issues
