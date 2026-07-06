# Performance Optimization and Testing Strategies

## Performance Optimization

### Batch Operations

```typescript
// ❌ Slow - Individual updates
for (const user of users) {
  await repo.updateOne({ status: "active" }, { _id: user._id });
}

// ✅ Fast - Bulk update
await repo.updateMany({ status: "active" }, { status: { $exists: false } });
```

**No mixed-operation batching:** `mzen-om` has no MongoDB-style `bulkWrite` — there is no way to submit a set of different `insertOne`/`updateOne`/`deleteOne` operations (each touching different documents with different values) as a single network round trip. `updateMany` only works when every matched document receives the _same_ update. If each document needs a distinct computed value, there is no way to avoid one `updateOne` round trip per document — the only lever available is pagination (`skip`/`limit`) to keep the working set bounded, not batching the writes themselves. See [Best Practices § Don't Load Large Datasets Into Memory](../best-practices/donts.md#6-dont-load-large-datasets-into-memory) for the decision rule and a paginated example.

**No pipeline updates, and `$mul`/`$min`/`$max` don't work on MySQL:** the update passed to `updateMany`/`updateOne` must be a plain object of operators (`$set`, `$inc`, `$unset`, `$push`, `$addToSet`, `$pop`, `$pull`, `$pullAll`, `$rename`) — not an aggregation pipeline array, so a computed update like `{ $set: { newField: { $multiply: ['$oldField', 2] } } }` is not supported. When the project's datasource is MySQL, only the operator list above is implemented; `$mul`, `$min`, and `$max` will throw `Unsupported operator`, even though they appear on `DataSourceInterface`'s TypeScript type. A same-value-for-every-document case (e.g. `{ $set: { status: 'active' } }`) is the only shape `updateMany` can express in one round trip; a per-document computed value (`newField = oldField * 2`) needs the paginated `find` + `updateOne` loop above.

### Index Creation Timing

```typescript
export default class OptimizedIndexCreation implements DatabasePatchInterface {
  version = "2024-02-12_1000";
  description = "Create indexes with optimization";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");

    // Create indexes after data is loaded, not before
    // This is faster than creating indexes first and then inserting data

    console.log("Loading data...");
    await loadLargeDataset();

    console.log("Creating indexes (this may take a while)...");
    await db.createIndex("users", { email: 1 }, { unique: true });
    console.log("✓ Indexes created");
  }
}
```

### Parallel Processing

```typescript
export default class ParallelMigration implements DatabasePatchInterface {
  version = "2024-02-13_1000";
  description = "Parallel data migration";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("user");

    // Process multiple batches in parallel
    const batchSize = 1000;
    const totalCount = await repo.count({});
    const batches = Math.ceil(totalCount / batchSize);

    console.log(`Processing ${totalCount} users in ${batches} batches...`);

    const promises = [];
    for (let i = 0; i < batches; i++) {
      const skip = i * batchSize;
      promises.push(this.processBatch(repo, skip, batchSize));
    }

    await Promise.all(promises);
    console.log(`✓ Processed ${totalCount} users`);
  }

  private async processBatch(repo, skip: number, limit: number) {
    const batch = await repo.find({}, { skip, limit });
    for (const user of batch) {
      await this.processUser(user);
    }
  }
}
```

## Testing Strategies

### Mock DataSource

```typescript
import { DataSourceMock } from "mzen-om";
import { ModelManager } from "mzen-om";

describe("Migration Tests", () => {
  it("should create indexes", async () => {
    // Create mock datasource
    const mockDS = new DataSourceMock({});

    // Create ModelManager with mock
    const modelManager = new ModelManager({});
    modelManager.addDataSource("db", mockDS);

    // Run migration
    const migration = new InitIndexes();
    await migration.update(modelManager);

    // Verify
    expect(mockDS.indexes).toHaveLength(3);
  });
});
```

### Integration Tests

```typescript
// test/integration/migrations.test.ts
import { MigrationManager } from "mzen-migrate";
import { setupTestDatabase, teardownTestDatabase } from "./helpers";

describe("Migration Integration Tests", () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  it("should migrate from scratch", async () => {
    const manager = new MigrationManager({
      modelManager: testModelManager,
      dataSourceName: "db",
      patchDirectory: "./migrate",
    });

    const result = await manager.migrate();

    expect(result.successCount).toBeGreaterThan(0);
    expect(result.failedCount).toBe(0);
  });

  it("should be idempotent", async () => {
    const manager = new MigrationManager({
      modelManager: testModelManager,
      dataSourceName: "db",
      patchDirectory: "./migrate",
    });

    // Run twice
    await manager.migrate();
    const result = await manager.migrate();

    // Second run should have no patches to apply
    expect(result.successCount).toBe(0);
  });
});
```

## Related Documentation

- [Advanced Usage Index](./index.md)
- [Troubleshooting](./troubleshooting.md)
- [Deployment Integration](./deployment.md)
