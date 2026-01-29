# Composite Keys

## Problem Statement

Originally, relations could only join on a single field:

```typescript
relations: {
  participant: {
    type: 'belongsToOne',
    repo: 'surveyParticipant',
    key: 'participantId',  // Can only match on this one field
  }
}
```

This was insufficient for multi-tenant scenarios where you need to match on multiple fields (e.g., `participantId` + `surveyId` + `projectId`).

## Solution: Unified Composite Keys

We implemented a **unified approach** where all joins are treated as composite key operations. Single-key joins are just composite keys with one field.

## Configuration

### Basic Composite Key

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

The `key` property is automatically merged with `keys` for backward compatibility.

### Multiple Composite Keys

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

## How It Works

### 1. Key Normalization

The `getNormalizedKeys` method converts legacy `key`/`pkey` and new `keys` into a unified format:

```typescript
// Input: { key: 'participantId', keys: { surveyId: 'surveyId' } }
// Output: { participantId: '_id', surveyId: 'surveyId' }
```

**Field direction:**
- For `belongsTo` relations: `key` is source field → `pkey` is target field
- For `has` relations: `pkey` is source field → `key` is target field

### 2. Composite ID Extraction

The `getCompositeRelationIds` method extracts field values from source documents:

```typescript
// Source docs: [{ participantId: 'p1', surveyId: 's1', projectId: 'proj1' }]
// Output: [{ participantId: 'p1', surveyId: 's1', projectId: 'proj1' }]
```

**Special cases:**
- Arrays for `belongsToMany` (e.g., `favouriteColorIds: ['1', '5']`)
- Missing fields (skipped from output)

### 3. Query Building

#### Single Key (Optimized)

```javascript
// Uses $in for better performance
{
  _id: {
    $in: ['p1', 'p2']
  }
}
```

#### Multiple Keys

```javascript
// Uses $or with compound conditions
{
  $or: [
    { participantId: 'p1', surveyId: 's1', projectId: 'proj1' },
    { participantId: 'p2', surveyId: 's2', projectId: 'proj2' },
  ]
}
```

### 4. Result Grouping

The `createCompositeKey` method groups results using composite key strings:

```typescript
// Single key: "p1"
// Multiple keys: "p1||s1||proj1"
```

This allows efficient lookup during population.

### 5. Population

The `populateValues` method:

1. Creates composite keys from source documents
2. Looks up related documents using those keys
3. Handles special cases:
   - `belongsToMany` with array source keys
   - `hasOne` vs `hasMany` (single doc vs array)
   - Empty results (undefined for `*One`, empty array for `*Many`)

## Query Optimization

The system automatically optimizes queries by detecting which fields are constant vs variant across documents.

### Scenario 1: All but one field is constant

**Input documents:**

```javascript
[
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

### Scenario 2: Multiple variant fields with grouping

**Input documents:**

```javascript
[
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

**Benefit:** 2 $or clauses instead of 3, with $in for variants within each group.

### How Optimization Works

The optimization is handled by `buildOptimizedCompositeQuery()` in [abstract.ts](../src/repo-populator/relation/abstract.ts):

1. **Analyze fields** (`analyzeCompositeFields`):
   - Detect which fields have the same value across all documents (constant)
   - Detect which fields have varying values (variant)
   - Skip array values (always treat as variant)

2. **Build optimized query**:
   - Add constant fields as simple equality: `{ field: value }`
   - If only one variant field, use `$in`: `{ field: { $in: [values] } }`
   - If multiple variant fields, group by constants and use `$or` with `$in` within groups

3. **Fallback for worst case**:
   - When all fields vary, falls back to full `$or` with individual conditions
   - Still better than naive approach because of de-duplication

## Use Cases

### Multi-Tenant Participant Matching

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

### Triple Composite Key

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

## When to Use Composite Keys

Use composite keys when:

- Multi-tenant applications need to scope relations by tenant/project/organization
- Sharded data requires matching on multiple dimensions
- Natural keys involve multiple fields
- You need to ensure relations match on business rules (e.g., same survey, same project)

## When NOT to Use Composite Keys

Stick with single keys when:

- Simple ID-based lookups are sufficient
- Data is not multi-tenant
- Performance is critical (single-key `$in` queries are faster)

## Design Decisions

1. **Unified Implementation**: No separate code paths for single vs composite keys
   - Simpler maintenance
   - Consistent behavior
   - Easier testing

2. **Backward Compatibility**: All existing single-key relations work unchanged
   - `key` property still supported
   - Automatically converted to `keys` format internally

3. **Query Optimization**:
   - **Single-key queries** use `$in` (faster)
   - **Constant field detection**: Analyzes composite IDs to identify fields with constant values
   - **Optimized multi-key queries**: Minimizes `$or` clauses by using `$in` for variant fields

4. **Field Direction Mapping**:
   - Keys map `sourceField: targetField`
   - For `belongsTo`: source is current repo, target is related repo
   - For `has`: source is parent (related) repo, target is current repo

## Composite Key String Format

Composite keys are concatenated with `||` delimiter:

- Single key: `"value1"`
- Multiple keys: `"value1||value2||value3"`
- Undefined values: `"value1||__undefined__||value3"` (skipped in practice)

This format is for internal grouping only and not exposed to users.

## See Also

- [Relations](relations.md) - General relation documentation
- [Performance](performance.md) - Database indexing strategies
- [Testing](testing.md) - Testing composite keys
