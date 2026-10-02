# Troubleshooting

### "Datasource not found"

**Problem:** Cannot find datasource 'workspace'

**Cause:** Dynamic datasources need context to resolve

**Solution:**

```bash
# Provide context for dynamic datasources
@datacapy/migrate --config ./migrate.config.js \
  --datasource workspace \
  --context workspaceId=abc123
```

### "Duplicate key error"

**Problem:** Patch tries to insert data that already exists

**Cause:** Patch is not idempotent

**Solution:** Make patch idempotent

```typescript
// Check before inserting
const existing = await repo.findOne({ code: "FREE" });
if (existing) {
  console.log("Already exists, skipping");
  return;
}
await repo.create({ code: "FREE", name: "Free" });
```

### "Invalid version format"

**Problem:** Version doesn't match `YYYY-MM-DD_HHMM` format

**Cause:** Filename and version property don't match

**Solution:** Ensure they match exactly

```typescript
// Filename: 2024-02-05_1430_add-table.ts
export default class AddTable implements DatabasePatchInterface {
  version = "2024-02-05_1430"; // Must match filename
  // ...
}
```

### "No patches to apply"

**Problem:** Migration says no patches found

**Possible Causes:**

1. All patches already applied
2. No patch files in directory
3. Patch versions are before current database version

**Solution:**

```bash
# Check current database version
@datacapy/migrate --config ./migrate.config.js --datasource db --verbose

# Check patch files
ls -la migrate/2024/02/

# Verify file naming follows pattern
# YYYY-MM-DD_HHMM_description.ts
```

### Migration Hangs

**Problem:** Migration appears to hang indefinitely

**Possible Causes:**

1. Database connection timeout
2. Large dataset processing
3. Deadlock

**Solution:**

```bash
# Run with verbose logging
@datacapy/migrate --config ./migrate.config.js --datasource db --verbose

# Check database connections
# (MySQL) SHOW PROCESSLIST;
# (MongoDB) db.currentOp()

# Add timeouts to patch
async update(modelManager: ModelManager): Promise<void> {
  const timeoutMs = 300000 // 5 minutes

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Migration timeout')), timeoutMs)
  })

  await Promise.race([
    this.doMigration(modelManager),
    timeoutPromise
  ])
}
```

### Transaction Rollback Failures

**Problem:** Transaction fails to rollback properly

**Cause:** Datasource doesn't support transactions, or transaction already closed

**Solution:**

```typescript
async update(modelManager: ModelManager): Promise<void> {
  const dataSource = modelManager.getDataSource('db')

  // Check if transactions are supported
  if (!dataSource.supportsTransactions()) {
    console.log('⚠ Datasource does not support transactions')
    // Implement manual rollback logic
  }

  try {
    await dataSource.beginTransaction()
    // Migration logic
    await dataSource.commitTransaction()
  } catch (error) {
    try {
      await dataSource.rollbackTransaction()
    } catch (rollbackError) {
      console.error('Failed to rollback:', rollbackError)
    }
    throw error
  }
}
```

## Related Documentation

- [Advanced Usage Index](./index.md)
- [Multi-Datasource Migrations](./multi-datasource.md)
- [Custom Workflows](./custom-workflows.md)
- [Performance and Testing](./performance-and-testing.md)
