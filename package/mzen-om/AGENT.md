<!-- cspell:ignore OAEP -->

# Mzen Agent Documentation

This document provides context for AI agents working on the mzen-om project.

## Purpose

This file contains high-level guidance and implementation patterns specifically
for AI agents. For detailed technical documentation, refer to the comprehensive
docs in the `docs/` directory and [README.md](README.md).

## Quick Reference

### Main Documentation

- **[README.md](README.md)** - User-facing overview and quick start
- **[docs/architecture.md](docs/architecture.md)** - Core concepts and system
  design
- **[docs/relations.md](docs/relations.md)** - Relation system overview and
  usage
- **[docs/composite-keys.md](docs/composite-keys.md)** - Composite key
  implementation details
- **[docs/dynamic-datasource.md](docs/dynamic-datasource.md)** -
  Multi-datasource system
- **[docs/validation.md](docs/validation.md)** - Validation and type-casting
- **[docs/testing.md](docs/testing.md)** - Testing patterns and MockDataSource
- **[docs/performance.md](docs/performance.md)** - Optimisation strategies
- **[docs/debugging.md](docs/debugging.md)** - Troubleshooting guide

### Core Files

#### Encryption System

- **[src/encryption/encryption-service-rsa.ts](src/encryption/encryption-service-rsa.ts)**:
  RSA+AES-256-GCM hybrid implementation (Node.js only)
- **[src/model-manager.ts](src/model-manager.ts)**:
  `ModelManagerConfig.encryptionService`, propagation in `initSchemas`
- **[mzen-schema/src/encryption/encryption-service.ts](../../mzen-schema/src/encryption/encryption-service.ts)**:
  `SchemaEncryptionService` interface
- **[mzen-schema/src/schema.ts](../../mzen-schema/src/schema.ts)**:
  `applyEncrypt`, `applyEncryptPaths`, `applyDecrypt`

#### Relation System

- **[src/repo-populator.ts](src/repo-populator.ts)** - Main orchestrator for
  populating relations
- **[src/repo-populator/relation/abstract.ts](src/repo-populator/relation/abstract.ts)** -
  Base class with shared logic
- **[src/repo-populator/relation/has-abstract.ts](src/repo-populator/relation/has-abstract.ts)** -
  Base for `hasOne`, `hasMany` relations
- **[src/repo-populator/relation/belongs-to-abstract.ts](src/repo-populator/relation/belongs-to-abstract.ts)** -
  Base for `belongsToOne`, `belongsToMany` relations

#### DataSource System

- **[src/data-source/context.ts](src/data-source/context.ts)** -
  DataSourceContext implementation
- **[src/data-source-manager.ts](src/data-source-manager.ts)** - Lookup
  registration and resolution
- **[src/model-manager.ts](src/model-manager.ts)** - Public API delegation
- **[src/data-source/registry.ts](src/data-source/registry.ts)** - Connection
  pool management
- **[src/data-source/index.ts](src/data-source/index.ts)** - DataSourceLookup
  interface

## Key Implementation Details for Agents

### Relation System Architecture

The relation system uses a class hierarchy with shared logic in abstract base
classes:

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

**Key design principle:** Unified implementation treats all joins as composite
key operations. Single-key joins are composite keys with one field.

### Common Patterns

#### When to Use Composite Keys

Use composite keys when:

- Multi-tenant applications need to scope relations by
  tenant/project/organisation
- Sharded data requires matching on multiple dimensions
- Natural keys involve multiple fields
- Business rules require matching on multiple fields (e.g., same survey, same
  project)

#### When NOT to Use Composite Keys

Stick with single keys when:

- Simple ID-based lookups are sufficient
- Data is not multi-tenant
- Performance is critical (single-key `$in` queries are faster)

#### Service Layer Pattern

```typescript
async getAll({ projectId, ...params }) {
  // Always create context for dynamic datasources
  const context = DataSourceContext.fromDataSources({
    project: { lookupKey: projectId }
  })

  const repo = this.getRepo('survey')
  const surveys = await repo.find(query, { context })
  return surveys
}
```

#### Testing Pattern

```typescript
// Mock datasource lookup
const mockLookup: DataSourceLookup = {
  async lookup(dataSourceName, lookupKey) {
    return {
      type: 'mysql',
      config: { database: `test_${lookupKey}` },
    }
  },
}

modelManager.setDataSourceLookup('project', mockLookup)

// Create context and test
const context = DataSourceContext.fromDataSources({
  project: { lookupKey: 'proj123' },
})

await repo.find({}, { context })
```

## Encryption

See [docs/encryption.md](docs/encryption.md) for usage and configuration.

### Design Decisions

- **RSA+AES hybrid**: pure RSA has a message size limit (~190 bytes for
  2048-bit key with SHA-256). AES-256-GCM encrypts the field value; RSA-OAEP
  encrypts a random AES key. No size limit on field values.
- **mzen-schema holds the interface; mzen-om holds the implementation**:
  `mzen-schema` is framework-agnostic and does not depend on Node.js.
  `SchemaEncryptionServiceRsa` lives in `mzen-om` which already requires
  Node.js.
- **`applyEncrypt`/`applyDecrypt` use `schemaIterator.iterate`**: same pattern
  as `applyFilters`. `applyEncryptPaths` uses `iteratePaths` for partial `$set`
  updates.
- **ModelManager propagation is opt-in per schema**: `initSchemas` sets
  `encryptionService` only on schemas that do not already have one, allowing
  per-schema overrides.

### Edge Cases

- **Null/undefined fields**: skipped silently (no encryption or decryption
  attempted).
- **Encrypted fields in queries**: `validateQuery` still runs but matches
  against ciphertext; value-based filters on encrypted fields will not return
  results.
- **No private key**: encryption works fine (public key only); decryption
  throws `'Private key not configured'`. Useful for write-only or reporting
  nodes.
- **Type preservation**: values are stringified (`String(value)`) before
  encryption. After decryption the schema's normal type-casting is applied
  during subsequent `validate` calls, but callers using `find` get strings back
  if no explicit cast is defined on the field.

## Critical Design Decisions

### 1. Unified Composite Keys

**Decision:** All joins are treated as composite key operations internally.

**Rationale:**

- Simpler maintenance (no separate code paths)
- Consistent behaviour
- Easier testing
- Backward compatible (single keys still work)

**Impact:** When modifying relation logic, ensure it works for both single and
multi-key scenarios.

### 2. Explicit Datasource Names

**Decision:** All DataSourceContext instances require explicit datasource names
(no wildcard fallback).

**Rationale:**

- Clear intent
- Easier debugging
- Prevents accidental misrouting

**Impact:** Always specify datasource name when creating contexts.

### 3. Query Optimisation

**Decision:** Automatically optimise composite key queries by detecting constant
vs variant fields.

**Rationale:**

- Significantly reduces `$or` clause count
- Better database performance
- Transparent to users

**Impact:** See [docs/composite-keys.md](docs/composite-keys.md) for
optimisation algorithm details.

### 4. Per-Datasource Lookup Registration

**Decision:** Each datasource has its own lookup implementation registered
separately.

**Rationale:**

- Supports multiple dynamic datasources (e.g., project + tenant)
- Clear separation of concerns
- Easy to extend

**Impact:** Use `Map<string, DataSourceLookup>` for storage, not a single global
lookup.

## Important Edge Cases

### 1. BelongsToMany with Arrays

Source documents can have array fields for `belongsToMany` relations:

```typescript
// Source: { favouriteColorIds: ['1', '5'] }
// Should match: { _id: '1' } and { _id: '5' }
```

Handle in `getCompositeRelationIds` by expanding arrays into multiple composite
IDs.

### 2. Missing Fields

When composite key fields are missing from source documents:

```typescript
// Source: { participantId: 'p1', surveyId: undefined }
// Should skip this document (don't create partial composite ID)
```

### 3. Empty Results

Different relation types handle empty results differently:

- `belongsToOne`, `hasOne` → `undefined`
- `belongsToMany`, `hasMany` → `[]` (empty array)
- `hasManyCount` → `0`

## Backward Compatibility Checklist

When modifying relation or datasource code:

1. ✓ **Existing single-key relations still work** - Test with legacy
   `key`/`pkey` config
2. ✓ **Default values preserved** - `pkey` defaults to `'_id'`
3. ✓ **Query format unchanged** - Single-key queries still use `$in`
4. ✓ **API signatures unchanged** - No breaking changes to public methods
5. ✓ **Error messages clear** - Help developers understand what's wrong

## Testing Requirements

When adding new features:

1. **Add tests for both single and composite keys** - Verify unified
   implementation
2. **Test edge cases** - Empty results, missing fields, arrays
3. **Test backward compatibility** - Ensure legacy configs still work
4. **Update MockDataSource if needed** - Support new query patterns
5. **Add optimisation tests** - Verify query optimisation works correctly

See [docs/testing.md](docs/testing.md) for detailed testing patterns.

## Performance Considerations

When making changes:

1. **Minimise database round-trips** - Batch queries where possible
2. **Use proper indexes** - Document required compound indexes
3. **Optimise queries** - Use constant field detection for composite keys
4. **Cache lookups** - Implement caching in DataSourceLookup implementations
5. **Connection pooling** - Configure registry and datasource pools
   appropriately

See [docs/performance.md](docs/performance.md) for optimisation strategies.

## Questions to Consider

When implementing new features or fixing bugs:

1. Does this change affect backward compatibility?
2. Do existing tests still pass?
3. Are composite keys handled correctly?
4. Is the field direction mapping correct for the relation type?
5. Are edge cases (empty results, missing fields, arrays) handled?
6. Does this require database index changes?
7. Is the error message clear and helpful?
8. Is this documented in the appropriate docs/ file?

## Test Coverage

This system has comprehensive test coverage (30+ tests):

- All relation types (belongsTo, has, embedded)
- Composite key scenarios
- Query optimisation
- Backward compatibility
- Edge cases

Test files are in `src/repo-populator/relation/_tests/`.

## Related Documentation

For detailed technical information, always refer to:

- [docs/composite-keys.md](docs/composite-keys.md) - Complete composite key
  implementation
- [docs/dynamic-datasource.md](docs/dynamic-datasource.md) - DataSourceContext
  system details
- [docs/relations.md](docs/relations.md) - Relation configuration and usage
- [docs/debugging.md](docs/debugging.md) - Troubleshooting guide

## Summary

This is a mature, battle-tested system with:

- Unified composite key implementation
- Multi-datasource support with explicit naming
- Automatic query optimisation
- Comprehensive test coverage
- Strong backward compatibility

When making changes, prioritise:

1. Maintaining backward compatibility
2. Clear error messages
3. Comprehensive tests
4. Good documentation
