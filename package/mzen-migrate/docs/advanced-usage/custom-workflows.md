# Custom Migration Workflows and Advanced Patterns

## Custom Migration Workflows

### Programmatic Usage

Instead of using the CLI, you can run migrations programmatically:

```typescript
import { MigrationManager } from "mzen-migrate";
import modelManager from "./model-manager";

async function runMigrations() {
  // Initialize ModelManager
  await modelManager.init();

  // Configure migration
  const config = {
    modelManager,
    dataSourceName: "db",
    patchDirectory: "./migrate",
    targetVersion: "latest",
    dryRun: false,
    verbose: true,
    stopOnError: true,
  };

  // Run migration
  const manager = new MigrationManager(config);
  const result = await manager.migrate();

  // Handle result
  console.log(`Applied ${result.successCount} patches`);
  console.log(`Current version: ${result.currentVersion}`);

  if (result.failedCount > 0) {
    console.error("Migration failed!");
    result.patchResults.forEach((r) => {
      if (r.status === "failed") {
        console.error(`${r.version}: ${r.error?.message}`);
      }
    });
    process.exit(1);
  }

  // Cleanup
  await modelManager.shutdown();
}

runMigrations().catch(console.error);
```

### Custom Logger

```typescript
import { MigrationManager } from "mzen-migrate";

const config = {
  modelManager,
  dataSourceName: "db",
  patchDirectory: "./migrate",
  logger: (message: string, level: "info" | "warn" | "error") => {
    // Custom logging logic
    if (level === "error") {
      myLogger.error(message);
    } else if (level === "warn") {
      myLogger.warn(message);
    } else {
      myLogger.info(message);
    }
  },
};

const manager = new MigrationManager(config);
await manager.migrate();
```

### Conditional Migrations

```typescript
export default class ConditionalMigration implements DatabasePatchInterface {
  version = "2024-02-07_1000";
  description = "Conditional feature migration";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const featureEnabled = process.env.ENABLE_FEATURE === "true";

    if (!featureEnabled) {
      console.log("⚠ Feature disabled, skipping migration");
      return;
    }

    console.log("Feature enabled, applying migration");
    // Migration logic
  }
}
```

## Advanced Patterns

### Patch Dependencies

Ensure one patch completes before another:

```typescript
// 2024-02-08_1000_create-tables.ts
export default class CreateTables implements DatabasePatchInterface {
  version = "2024-02-08_1000";
  description = "Create tables";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    // Create tables
    await createUserTable();
    await createRoleTable();
  }
}

// 2024-02-08_1001_create-indexes.ts
export default class CreateIndexes implements DatabasePatchInterface {
  version = "2024-02-08_1001";
  description = "Create indexes (depends on 1000)";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    // This runs after 1000 due to version ordering
    await createIndexes();
  }
}
```

Version ordering ensures dependencies are respected: `1000` runs before `1001`.

### External Data Loading

```typescript
import { readFile } from "fs/promises";
import path from "path";

export default class LoadExternalData implements DatabasePatchInterface {
  version = "2024-02-09_1000";
  description = "Load data from external file";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("product");

    // Load data from JSON file
    const dataPath = path.join(__dirname, "../data/products.json");
    const rawData = await readFile(dataPath, "utf-8");
    const products = JSON.parse(rawData);

    // Validate data
    if (!Array.isArray(products)) {
      throw new Error("Invalid product data format");
    }

    // Insert products
    console.log(`Importing ${products.length} products...`);
    for (const product of products) {
      await repo.create(product);
    }

    console.log(`✓ Imported ${products.length} products`);
  }
}
```

### Progress Reporting

```typescript
export default class LargeMigration implements DatabasePatchInterface {
  version = "2024-02-10_1000";
  description = "Large data migration with progress";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("user");

    const totalCount = await repo.count({});
    console.log(`Processing ${totalCount} users...`);

    let processed = 0;
    let skip = 0;
    const limit = 1000;

    while (true) {
      const batch = await repo.find({}, { skip, limit });
      if (batch.length === 0) break;

      for (const user of batch) {
        await processUser(user);
        processed++;

        // Report progress every 100 users
        if (processed % 100 === 0) {
          const percent = ((processed / totalCount) * 100).toFixed(1);
          console.log(`Progress: ${processed}/${totalCount} (${percent}%)`);
        }
      }

      skip += limit;
    }

    console.log(`✓ Processed ${processed} users`);
  }
}
```

### Validation Migrations

```typescript
export default class ValidateData implements DatabasePatchInterface {
  version = "2024-02-11_1000";
  description = "Validate and fix data inconsistencies";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("user");

    // Find invalid records
    const invalidUsers = await repo.find({
      $or: [{ email: { $exists: false } }, { email: "" }, { email: null }],
    });

    if (invalidUsers.length > 0) {
      console.log(`⚠ Found ${invalidUsers.length} users with invalid emails`);

      // Option 1: Fix them
      for (const user of invalidUsers) {
        await repo.updateOne(
          { email: `user-${user._id}@example.com` },
          { _id: user._id },
        );
      }

      // Option 2: Delete them
      // await repo.deleteMany({ _id: { $in: invalidUsers.map(u => u._id) } })

      console.log(`✓ Fixed ${invalidUsers.length} users`);
    } else {
      console.log("✓ All users have valid emails");
    }
  }
}
```

## Related Documentation

- [Advanced Usage Index](./index.md)
- [Multi-Datasource Migrations](./multi-datasource.md)
- [Troubleshooting](./troubleshooting.md)
