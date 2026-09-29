# @datacapy/migrate

Database migration tool for @datacapy/om applications. Manage schema changes, data transformations, and database versioning across multiple datasources with transaction safety and rollback support.

## Features

- **Multi-Datasource Support**: Migrate account-level databases, project-specific databases, or any custom datasource
- **Transaction Safety**: Each patch runs in a transaction with automatic rollback on failure
- **Version Tracking**: Track applied migrations in a metadata table
- **Dry Run Mode**: Preview changes without applying them
- **TypeScript First**: Full TypeScript support with type-safe patch interfaces
- **Flexible Organisation**: Organise patches by year/month with timestamped versions
- **Resume Capability**: Automatically resume from last successful patch
- **CLI Tool**: Simple command-line interface for running migrations

## Installation

```bash
pnpm add @datacapy/migrate
```

## Quick Start

### 1. Create a Migration Config

Create `migrate.config.js` in your project root:

```javascript
const modelManager = require("./src/model-manager").default;

module.exports = async () => {
  return {
    modelManager, // Your existing ModelManager instance
    patchDirectory: "./migrate",
  };
};
```

### 2. Create Your First Patch

Create patches in `migrate/YYYY/MM/YYYY-MM-DD_HHMM_label.ts`:

```typescript
// migrate/2024/02/2024-02-05_1430_add-users-table.ts
import { DatabasePatchInterface } from "@datacapy/migrate";
import { ModelManager } from "@datacapy/om";

export default class AddUsersTable implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Add users table";
  dataSourceName = "db"; // Target datasource

  async update(modelManager: ModelManager): Promise<void> {
    const dataSource = modelManager.getDataSource("db");

    // Your migration logic here
    await dataSource.insertOne("users", {
      _id: "000000000000000000000001",
      email: "admin@example.com",
      role: "admin",
    });
  }
}
```

### 3. Run Migration

```bash
# Migrate account-level database
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db

# Preview changes first
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db --dry-run

# Migrate with verbose output
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db --verbose
```

## CLI Reference

### Command Syntax

```bash
@datacapy/migrate [OPTIONS]
```

### Required Options

- `-c, --config <file>` - Path to migration config file
- `--datasource <name>` - Target datasource name (e.g., 'db', 'project')

### Optional Options

- `--context <key=value>` - Context for dynamic datasources (can be specified multiple times)
- `-d, --patch-dir <dir>` - Patch directory (default: ./migrate)
- `-t, --target <version>` - Target version to migrate to (default: latest)
- `--dry-run` - Preview migration without making changes
- `-v, --verbose` - Enable verbose logging
- `-h, --help` - Show help message
- `--version` - Show package version

### Examples

```bash
# Migrate account-level database
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db

# Migrate specific project database (dynamic datasource)
pnpm @datacapy/migrate --config ./migrate.config.js \\
  --datasource project \\
  --context projectId=abc123

# Dry run to preview changes
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db --dry-run

# Migrate to specific version
pnpm @datacapy/migrate --config ./migrate.config.js \\
  --datasource db \\
  --target 2024-02-05_1430

# Verbose output
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db --verbose
```

## Configuration

### Config File

The config file should export an async function that returns a `MigrationConfig` object:

```typescript
import { ModelManager } from "@datacapy/om";

export default async () => {
  return {
    modelManager, // Required: Your ModelManager instance
    patchDirectory: "./migrate", // Optional: Patch directory
    verbose: false, // Optional: Enable verbose logging
  };
};
```

### Configuration Options

- `modelManager`: **Required** - Existing ModelManager instance with configured datasources
- `dataSourceName`: **Required** - Provided via CLI `--datasource` argument
- `context`: **Optional** - Provided via CLI `--context` argument for dynamic datasources
- `patchDirectory`: **Optional** - Directory containing patches (default: './migrate')
- `targetVersion`: **Optional** - Target version to migrate to (default: latest)
- `metaTableName`: **Optional** - Name of meta table (default: 'migrationMeta')
- `dryRun`: **Optional** - Preview mode (default: false)
- `verbose`: **Optional** - Verbose logging (default: false)
- `stopOnError`: **Optional** - Stop on first error (default: true)
- `logger`: **Optional** - Custom logger function

## Writing Patches

### Patch Interface

All patches must implement `DatabasePatchInterface`:

```typescript
export interface DatabasePatchInterface {
  version: string; // Format: YYYY-MM-DD_HHMM
  description: string; // Human-readable description
  dataSourceName: string; // Target datasource: 'db', 'project', etc.
  update(modelManager: ModelManager): Promise<void>;
}
```

### Patch File Structure

Patches must be organised in a timestamped directory structure:

```
migrate/
├── 2024/
│   ├── 01/
│   │   ├── 2024-01-15_1200_add-users-table.ts
│   │   └── 2024-01-20_1430_add-user-indexes.ts
│   └── 02/
│       ├── 2024-02-05_1430_add-validation.ts
│       └── 2024-02-10_0900_seed-data.ts
```

### Example Patches

#### Simple Table Creation

```typescript
import { DatabasePatchInterface } from "@datacapy/migrate";
import { ModelManager } from "@datacapy/om";

export default class AddUsersTable implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Add users table";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");

    // Insert initial record to create table
    await db.insertOne("users", {
      _id: "000000000000000000000001",
      email: "admin@example.com",
      role: "admin",
      createdAt: new Date(),
    });
  }
}
```

#### Adding Indexes

```typescript
export default class AddUserIndexes implements DatabasePatchInterface {
  version = "2024-02-06_1000";
  description = "Add indexes to users table";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");

    // Create unique index on email
    await db.createIndex(
      "users",
      { email: 1 },
      {
        name: "idx_users_email",
        unique: true,
      },
    );

    // Create index on createdAt
    await db.createIndex(
      "users",
      { createdAt: -1 },
      {
        name: "idx_users_created",
      },
    );
  }
}
```

#### Using Repositories

```typescript
export default class SeedDefaultRoles implements DatabasePatchInterface {
  version = "2024-02-07_1400";
  description = "Seed default user roles";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    // Access repo through ModelManager
    const roleRepo = modelManager.getRepo("role");

    // Check if already seeded
    const count = await roleRepo.count();
    if (count > 0) {
      console.log("Roles already exist, skipping seed");
      return;
    }

    // Insert default roles
    await roleRepo.insertMany([
      { name: "admin", permissions: ["*"] },
      { name: "editor", permissions: ["read", "write"] },
      { name: "viewer", permissions: ["read"] },
    ]);
  }
}
```

#### Project-Specific Migration

```typescript
export default class AddProjectStatus implements DatabasePatchInterface {
  version = "2024-02-08_1000";
  description = "Add status field to surveys";
  dataSourceName = "project"; // Targets dynamic project datasource

  async update(modelManager: ModelManager): Promise<void> {
    // Get project datasource (resolved via CLI --context)
    const projectDS = modelManager.getDataSource("project");

    // Update all surveys in this project
    await projectDS.updateMany(
      "surveys",
      {},
      {
        $set: { status: "draft" },
      },
    );
  }
}
```

## Multi-Datasource Migrations

@datacapy/migrate supports migrating multiple datasources independently:

### Account-Level Migrations

Migrate the main account database:

```bash
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db
```

### Project-Level Migrations

Migrate a specific project's database:

```bash
pnpm @datacapy/migrate --config ./migrate.config.js \\
  --datasource project \\
  --context projectId=abc123
```

### Migrating Multiple Projects

```bash
# Get all project IDs, then migrate each
for projectId in $(get-project-ids); do
  echo "Migrating project $projectId..."
  pnpm @datacapy/migrate --config ./migrate.config.js \\
    --datasource project \\
    --context projectId=$projectId
done
```

## Version Format

Versions use the format `YYYY-MM-DD_HHMM`:

- **YYYY**: 4-digit year
- **MM**: 2-digit month (01-12)
- **DD**: 2-digit day (01-31)
- **HHMM**: 4-digit time (0000-2359)

Examples:

- `2024-02-05_1430` - February 5, 2024 at 2:30 PM
- `2024-12-31_2359` - December 31, 2024 at 11:59 PM

**Benefits:**

- Natural chronological ordering
- Easy to generate: `const version = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '')`
- Eliminates merge conflicts (timestamps are unique)
- Human-readable

## Transaction Safety

### Automatic Transactions

Each patch runs in a transaction with automatic rollback on failure:

```typescript
// This patch will rollback if any operation fails
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
2. Successfully applied patches remain applied
3. Running the migration again resumes from where it stopped

```bash
# First run - patches 1 and 2 succeed, patch 3 fails
$ pnpm @datacapy/migrate --config ./migrate.config.js --datasource db
# ✓ Patch 1 applied
# ✓ Patch 2 applied
# ✗ Patch 3 failed - rolled back

# Fix the issue in patch 3 and run again
$ pnpm @datacapy/migrate --config ./migrate.config.js --datasource db
# Skipping patch 1 (already applied)
# Skipping patch 2 (already applied)
# ✓ Patch 3 applied
```

## Metadata Tracking

Migration status is tracked in a `migrationMeta` table (customisable via `metaTableName`):

```javascript
{
  version: '2024-02-05_1430',
  description: 'Add users table',
  appliedAt: new Date('2024-02-05T14:30:00Z'),
  duration: 150  // milliseconds
}
```

### Querying Migration Status

```typescript
import { MetaTable } from "@datacapy/migrate";

// Get current database version
const metaTable = new MetaTable(dataSource, "migrationMeta");
const currentVersion = await metaTable.getCurrentVersion();
console.log(`Current version: ${currentVersion}`);

// Get all applied patches
const patches = await metaTable.getAppliedPatches();
patches.forEach((p) => {
  console.log(`${p.version}: ${p.description} (applied ${p.appliedAt})`);
});

// Check if specific patch was applied
const isApplied = await metaTable.isPatchApplied("2024-02-05_1430");
```

## Programmatic Usage

You can also use @datacapy/migrate programmatically:

```typescript
import { MigrationManager } from "@datacapy/migrate";
import modelManager from "./src/model-manager";

const config = {
  modelManager,
  dataSourceName: "db",
  patchDirectory: "./migrate",
  verbose: true,
};

const manager = new MigrationManager(config);
const result = await manager.migrate();

console.log(`Applied ${result.successCount} patches`);
console.log(`Current version: ${result.currentVersion}`);

if (result.failedCount > 0) {
  console.error("Migration failed!");
  result.patchResults.forEach((r) => {
    if (r.status === "failed") {
      console.error(`${r.version}: ${r.error?.message}`);
    }
  });
}
```

## Best Practices

### 1. Always Use Dry Run First

```bash
pnpm @datacapy/migrate --config ./migrate.config.js --datasource db --dry-run
```

### 2. Commit Patches to Version Control

Patches should be committed to Git for team coordination and deployment automation.

### 3. Keep Patches Atomic

Each patch should do one thing and be reversible if needed:

```typescript
// Good - Single, clear purpose
export default class AddUserEmailIndex implements DatabasePatchInterface {
  version = "2024-02-10_1000";
  description = "Add index on users.email for faster lookups";
  dataSourceName = "db";
  // ...
}

// Avoid - Multiple unrelated changes
export default class MiscChanges implements DatabasePatchInterface {
  version = "2024-02-10_1100";
  description = "Add indexes, update roles, and seed data";
  dataSourceName = "db";
  // Too much in one patch!
}
```

### 4. Test Patches Locally First

Use DataSourceMock to test patches:

```typescript
import { DataSourceMock } from "@datacapy/om";
import AddUsersTable from "./2024-02-05_1430_add-users-table";

describe("AddUsersTable patch", () => {
  it("should create users table", async () => {
    const mockDS = new DataSourceMock({});
    const mockMM = new ModelManager({});
    mockMM.addDataSource("db", mockDS);

    const patch = new AddUsersTable();
    await patch.update(mockMM);

    // Verify patch worked
    expect(mockDS.dataInsert).toHaveLength(1);
  });
});
```

### 5. Use Descriptive Patch Names

```
✓ 2024-02-05_1430_add-users-table.ts
✓ 2024-02-06_1000_add-user-email-index.ts
✓ 2024-02-07_1400_seed-default-roles.ts

✗ 2024-02-05_1430_patch1.ts
✗ 2024-02-06_1000_update.ts
✗ 2024-02-07_1400_fix.ts
```

### 6. Handle Idempotency

Patches should be safe to run multiple times:

```typescript
export default class SeedData implements DatabasePatchInterface {
  version = "2024-02-11_1000";
  description = "Seed initial data";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("setting");

    // Check if already seeded
    const exists = await repo.findOne({ key: "app.initialized" });
    if (exists) {
      console.log("Already initialized, skipping");
      return;
    }

    // Safe to seed
    await repo.insertOne({ key: "app.initialized", value: true });
  }
}
```

## Troubleshooting

### Migration Fails with "Datasource not found"

**Problem:** Cannot find datasource 'project'

**Solution:** Dynamic datasources need context:

```bash
pnpm @datacapy/migrate --config ./migrate.config.js \\
  --datasource project \\
  --context projectId=abc123
```

### Patch Throws "Duplicate key error"

**Problem:** Patch already applied, trying to re-apply

**Solution:** Check meta table, patch may have been applied in previous run:

```typescript
const metaTable = new MetaTable(dataSource);
const isApplied = await metaTable.isPatchApplied("2024-02-05_1430");
```

### Invalid Version Format Error

**Problem:** Version doesn't match `YYYY-MM-DD_HHMM` format

**Solution:** Ensure version and filename match exactly:

```typescript
// Filename: 2024-02-05_1430_add-table.ts
export default class AddTable implements DatabasePatchInterface {
  version = "2024-02-05_1430"; // Must match filename
  // ...
}
```

## API Reference

### MigrationManager

```typescript
class MigrationManager {
  constructor(config: MigrationConfig);
  migrate(): Promise<MigrationResult>;
}
```

### MetaTable

```typescript
class MetaTable {
  constructor(dataSource: DataSourceInterface, tableName?: string);
  initialize(): Promise<void>;
  getCurrentVersion(): Promise<string>;
  recordPatch(
    version: string,
    description: string,
    duration?: number,
  ): Promise<void>;
  getAppliedPatches(): Promise<MetaRecord[]>;
  isPatchApplied(version: string): Promise<boolean>;
}
```

### VersionManager

```typescript
class VersionManager {
  static parseVersion(version: string): number;
  static compareVersions(v1: string, v2: string): number;
  static sortVersions(versions: string[]): string[];
  static isValidVersion(version: string): boolean;
  static generateVersion(date?: Date): string;
  static getLatestVersion(versions: string[]): string | undefined;
}
```

## Documentation

- **[Architecture](./docs/architecture/index.md)** - Migration system internals and technical implementation
- **[Best Practices](./docs/best-practices/index.md)** - Guidelines for writing safe, maintainable migrations
- **[Advanced Usage](./docs/advanced-usage/index.md)** - Advanced patterns, troubleshooting, and deployment

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

BSD-3-Clause

## Support

- Documentation: https://github.com/kevin-foster-uk/mzen
- Issues: https://github.com/kevin-foster-uk/mzen/issues
