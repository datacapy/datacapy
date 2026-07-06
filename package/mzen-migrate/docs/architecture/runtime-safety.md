# Runtime Safety

## Transaction Safety

### Automatic Transactions

Each patch runs in a transaction with automatic rollback on failure:

```typescript
// All operations in this patch are in a transaction
export default class SafeMigration implements DatabasePatchInterface {
  version = "2024-02-09_1000";
  description = "Safe migration with automatic rollback";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");

    // All these operations are in a transaction
    await db.insertOne("users", { email: "user1@example.com" });
    await db.insertOne("users", { email: "user2@example.com" });

    // If this fails, both inserts are rolled back
    await db.createIndex("users", { email: 1 }, { unique: true });
  }
}
```

### Resume Capability

If a migration fails:

1. All changes from the failed patch are rolled back
2. Successfully applied patches remain applied (already committed)
3. Running the migration again resumes from where it stopped

```bash
# First run - patches 1 and 2 succeed, patch 3 fails
$ mzen-migrate --config ./migrate.config.js --datasource db
# ✓ Patch 1 applied and committed
# ✓ Patch 2 applied and committed
# ✗ Patch 3 failed - rolled back, NOT recorded in meta

# Fix the issue in patch 3 and run again
$ mzen-migrate --config ./migrate.config.js --datasource db
# Skipping patch 1 (already in meta table)
# Skipping patch 2 (already in meta table)
# ✓ Patch 3 applied and committed
```

## Dry-Run Mode

### How It Works

```typescript
if (config.dryRun) {
  // 1. Meta table reads execute normally
  // 2. Patches execute normally
  // 3. Transactions are rolled back at the end
  // 4. migrationMeta is NOT updated
}
```

### Implementation

```typescript
async executePatchDryRun(patch: DatabasePatchInterface): Promise<PatchResult> {
  const startTime = Date.now()
  const dataSource = this.modelManager.getDataSource(patch.dataSourceName)

  // Begin transaction
  await dataSource.beginTransaction()

  try {
    // Execute patch logic (writes happen in transaction)
    await patch.update(this.modelManager)

    // ALWAYS rollback in dry-run mode
    await dataSource.rollbackTransaction()

    // Return success (but nothing was actually committed)
    return {
      version: patch.version,
      status: 'success',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    // Rollback transaction
    await dataSource.rollbackTransaction()

    // Return failure
    return {
      version: patch.version,
      status: 'failed',
      duration: Date.now() - startTime,
      error: error as Error,
    }
  }
}
```

**Limitation:** Dry-run may not perfectly predict actual execution since all changes are rolled back.

## Performance Considerations

### Large Datasets

For migrations affecting many records:

```typescript
// ❌ Bad: Load all records into memory
const allUsers = await repo.find({});
for (const user of allUsers) {
  await repo.updateOne(
    {
      /* ... */
    },
    { _id: user._id },
  );
}

// ✅ Good: Batch updates
await repo.updateMany({ newField: "value" }, { newField: { $exists: false } });

// ✅ Good: Paginated processing
let skip = 0;
const limit = 1000;
while (true) {
  const batch = await repo.find({}, { skip, limit });
  if (batch.length === 0) break;

  for (const record of batch) {
    await processRecord(record);
  }

  skip += limit;
}
```

### Index Creation

```typescript
// Index creation can be slow on large tables
console.log("Creating indexes (this may take a while)...");
await repo.createIndexes();
```

**Tip:** Schedule migrations during maintenance windows for production.

## Error Handling

### Migration Failure Behaviour

**When a migration fails:**

1. ❌ Patch execution stops
2. ❌ Transaction is rolled back
3. ❌ Error is logged
4. ❌ Migration is NOT recorded in migrationMeta
5. ❌ Subsequent patches are NOT executed (if `stopOnError: true`)
6. ✅ Previous successful patches remain applied

**Recovery:**

```bash
# Fix the issue (code or database)
# Re-run migration - it will pick up where it left off
mzen-migrate --config ./migrate.config.js --datasource db
```

### Custom Error Handling

```typescript
export default class CustomErrorHandling implements DatabasePatchInterface {
  version = "2024-02-10_1000";
  description = "Migration with custom error handling";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("user");

    try {
      await repo.createIndexes();
    } catch (error) {
      // Handle specific error gracefully
      if (error.message.includes("already exists")) {
        console.log("⚠ Indexes already exist, continuing...");
      } else {
        // Re-throw to trigger rollback
        throw error;
      }
    }
  }
}
```

## Security Considerations

### 1. Never Store Sensitive Data in Migrations

```typescript
// ❌ Bad
await repo.create({
  email: "admin@example.com",
  password: "hardcodedpassword123", // ❌ Never hardcode
});

// ✅ Good
await repo.create({
  email: "admin@example.com",
  password: await hashPassword(process.env.ADMIN_PASSWORD),
});
```

### 2. Validate Input Data

```typescript
// Validate before inserting
const seedData = INITIAL_DATA;
for (const data of seedData) {
  if (!data.code || !data.name) {
    throw new Error("Invalid data");
  }
  await repo.create(data);
}
```

### 3. Backup Before Destructive Operations

```typescript
async update(modelManager: ModelManager): Promise<void> {
  // Always backup before destructive changes
  console.log('⚠ This migration deletes data')
  console.log('⚠ Ensure you have a backup before proceeding')

  // Add safety check
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    throw new Error('Manual confirmation required in production')
  }

  // Destructive operation
  await repo.deleteMany({ status: 'obsolete' })
}
```

## Related Documentation

- [Architecture Index](./index.md)
- [System Components](./components.md)
- [Execution Flow](./execution-flow.md)
