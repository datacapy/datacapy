# Debugging

## Query Logging

To see what queries are being generated, add logging to the relation classes:

### Has Relations

Add to [has-abstract.ts](../src/repo-populator/relation/has-abstract.ts) around line 40:

```typescript
console.log('Has Query:', JSON.stringify(config.query))
const relatedDocs = await repo.find(config.query)
console.log('Related docs:', relatedDocs.length)
```

### BelongsTo Relations

Add to [belongs-to-abstract.ts](../src/repo-populator/relation/belongs-to-abstract.ts) around line 54:

```typescript
console.log('BelongsTo Query:', JSON.stringify(config.query))
const relatedDocs = await repo.find(config.query)
console.log('Related docs:', relatedDocs)
```

### Detailed Query Analysis

For more detailed analysis:

```typescript
console.log('Composite IDs:', compositeIds)
console.log('Normalized Keys:', normalizedKeys)
console.log('Generated Query:', JSON.stringify(config.query, null, 2))
console.time('query-execution')
const relatedDocs = await repo.find(config.query)
console.timeEnd('query-execution')
console.log('Result count:', relatedDocs.length)
```

## Common Issues

### No Results Returned

**Symptoms:** Relation population returns undefined or empty array

**Possible Causes:**

1. **Missing composite key fields**
   - Check that all fields specified in `keys` exist in both source and target documents
   - Verify field names match exactly (case-sensitive)

2. **Data type mismatch**
   - Ensure field types match (string vs number)
   - Check for ObjectID vs string mismatches

3. **Incorrect field direction**
   - Verify `key` and `pkey` are mapped correctly for relation type
   - belongsTo: `key` is source field, `pkey` is target field
   - has: `pkey` is source field, `key` is target field

**Debugging steps:**

```typescript
// Enable query logging (see above)
// Check the generated query
console.log('Query:', query)

// Manually verify target documents exist
const targetDocs = await targetRepo.find({})
console.log('Target docs:', targetDocs)

// Check if composite keys are correct
console.log('Source composite IDs:', compositeIds)
```

### Wrong Results Returned

**Symptoms:** Relation returns incorrect or unexpected documents

**Possible Causes:**

1. **Field direction is reversed**
   - Check if `key` and `pkey` should be swapped
   - Review relation type (belongsTo vs has)

2. **Key merging issue**
   - Verify `key` and `keys` are being merged correctly
   - Check if `key` is being overridden

3. **Query optimization issue**
   - Generated query may have incorrect constant/variant detection
   - Check the actual query being sent to database

**Debugging steps:**

```typescript
// Log normalized keys
console.log('Normalized keys:', this.getNormalizedKeys())

// Log composite IDs being generated
console.log('Composite IDs:', compositeIds)

// Verify query structure
console.log('Query:', JSON.stringify(query, null, 2))
```

### Performance Issues

**Symptoms:** Queries are slow or timing out

**Possible Causes:**

1. **Missing database indexes**
   - Compound indexes not created on target collection
   - Index doesn't cover all composite key fields

2. **Too many $or clauses**
   - Constant field detection not working
   - All fields are variant

3. **Large result sets**
   - No limit on query results
   - Population cascade loading too much data

**Debugging steps:**

```typescript
// Check number of $or clauses
console.log('$or count:', query.$or?.length)

// Time the query
console.time('query')
const results = await repo.find(query)
console.timeEnd('query')

// Check result set size
console.log('Results:', results.length)

// Use database explain plan
// MongoDB:
db.collection.find(query).explain('executionStats')

// MySQL:
EXPLAIN SELECT ...
```

See [Performance](performance.md) for optimization strategies.

### DataSource Context Issues

**Symptoms:** "No datasource context provided" or "No DataSourceLookup configured"

**Possible Causes:**

1. **Lookup not registered**
   - DataSourceLookup not configured for datasource name
   - Wrong datasource name used

2. **Context not passed**
   - Service not creating context
   - Context not passed to repo methods

3. **Wrong datasource name**
   - Repo configured with different name than context provides

**Debugging steps:**

```typescript
// Verify lookup is registered
console.log('Available lookups:', modelManager.getDataSourceLookups())

// Verify context has correct datasource
console.log('Context datasources:', Object.keys(context.dataSources))

// Verify repo datasource name
console.log('Repo datasource:', repo.config.dataSource)
```

See [DataSource Context](datasource-context.md) for detailed troubleshooting.

### Validation Errors

**Symptoms:** Insert/update operations fail with validation errors

**Debugging steps:**

```typescript
// Catch validation errors
try {
  await repo.insert(data)
} catch (error) {
  if (error.isValidationError) {
    console.log('Validation errors:', error.fields)
    // Shows which fields failed and why
  }
}

// Test schema validation directly
const errors = schema.validate(data)
console.log('Validation errors:', errors)

// Check what data is being validated
console.log('Data:', JSON.stringify(data, null, 2))
```

## Troubleshooting Checklist

When debugging relation issues:

1. ✓ **Field names** - Are they spelled correctly? Case-sensitive?
2. ✓ **Data types** - Do source and target field types match?
3. ✓ **Field direction** - Is `key`/`pkey` mapping correct for relation type?
4. ✓ **Data exists** - Do target documents actually exist in database?
5. ✓ **Indexes** - Are compound indexes created on target collection?
6. ✓ **Query structure** - Does generated query look correct?
7. ✓ **Context** - Is datasource context provided and configured correctly?

## Database-Specific Debugging

### MongoDB

View generated queries:

```javascript
// Enable MongoDB query logging
db.setProfilingLevel(2)

// View recent queries
db.system.profile.find().sort({ ts: -1 }).limit(10)

// Explain query performance
db.collection.find(query).explain('executionStats')
```

### MySQL

View generated queries:

```sql
-- Enable query logging
SET GLOBAL general_log = 'ON';
SET GLOBAL log_output = 'TABLE';

-- View recent queries
SELECT * FROM mysql.general_log ORDER BY event_time DESC LIMIT 10;

-- Explain query performance
EXPLAIN SELECT ...
```

## Getting Help

If you're stuck:

1. **Enable query logging** - See what queries are actually being generated
2. **Check test cases** - Similar scenarios in [src/repo-populator/relation/_tests/](../src/repo-populator/relation/_tests/)
3. **Review error messages** - They often indicate exactly what's wrong
4. **Check indexes** - Missing indexes are a common cause of performance issues

## See Also

- [Relations](relations.md) - Understanding relation configuration
- [Composite Keys](composite-keys.md) - Multi-field relation matching
- [DataSource Context](datasource-context.md) - Dynamic datasource debugging
- [Performance](performance.md) - Query optimization
- [Testing](testing.md) - Testing strategies
