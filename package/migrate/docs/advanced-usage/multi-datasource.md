# Multi-Datasource Migrations and Dynamic Context Resolution

## Multi-Datasource Migrations

### Migrating Multiple Datasources

@datacapy/migrate supports migrating multiple independent datasources. Each datasource maintains its own migration history.

#### Main-Database Database

```bash
# Migrate main database
@datacapy/migrate --config ./migrate.config.js --datasource db
```

Patches targeting this datasource:

```typescript
export default class InitMainIndexes implements DatabasePatchInterface {
  version = "2024-02-05_1000";
  description = "Initialize main-level indexes";
  dataSourceName = "db"; // Targets main database

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");
    // Migrate main database
  }
}
```

#### Workspace-Specific Databases

```bash
# Migrate specific workspace database
@datacapy/migrate --config ./migrate.config.js \
  --datasource workspace \
  --context workspaceId=abc123
```

Patches targeting workspace datasources:

```typescript
export default class AddWorkspaceFeature implements DatabasePatchInterface {
  version = "2024-02-05_1100";
  description = "Add feature to workspace database";
  dataSourceName = "workspace"; // Targets workspace database

  async update(modelManager: ModelManager): Promise<void> {
    // Repos are pre-wired to the workspace's actual datasource by the migration runner
    const repo = modelManager.getRepo("myRepo");
    // Migrate this specific workspace's database
  }
}
```

#### Migrating All Workspaces (Wildcard Pattern)

Use the context lookup feature to migrate all workspaces with a single command:

```bash
# Migrate all workspace databases sequentially
@datacapy/migrate --config ./migrate.config.js \
  --datasource workspace \
  --context-lookup "*"

# With dry-run to preview
@datacapy/migrate --config ./migrate.config.js \
  --datasource workspace \
  --context-lookup "*" \
  --dry-run
```

This requires implementing a `ContextResolver` in your application's configuration:

```typescript
// migrate.config.js
import { ContextResolverWorkspace } from "./src/context/ContextResolverWorkspace";
import { modelManager } from "./src/model-manager";

export default async () => {
  await modelManager.init();

  // Create context resolver for wildcard pattern support
  const mainDataSource = modelManager.getDataSource("db");
  const contextResolver = new ContextResolverWorkspace(mainDataSource);

  return {
    modelManager,
    contextResolver, // Enable context lookup patterns
    patchDirectory: "./migrate",
  };
};
```

**ContextResolver implementation example:**

```typescript
// src/context/ContextResolverWorkspace.ts
import { ContextResolver } from "@datacapy/migrate";
import { DataSourceInterface } from "@datacapy/om";

export class ContextResolverWorkspace implements ContextResolver {
  constructor(private mainDataSource: DataSourceInterface) {}

  async resolve(pattern: string): Promise<Array<Record<string, string>>> {
    if (pattern === "*") {
      // Query all workspaces from main database
      const workspaces = await this.mainDataSource.find("workspace", {});

      // Convert to context value objects
      return workspaces.map((workspace) => ({
        workspaceId: workspace._id,
      }));
    }

    // Support other patterns as needed
    throw new Error(`Unsupported context pattern: ${pattern}`);
  }
}
```

**How it works:**

1. The `--context-lookup "*"` pattern is passed to the ContextResolver
2. The resolver queries the main database for all workspaces
3. MigrationManager runs migrations sequentially for each workspace (one at a time)
4. If any workspace fails, the process stops immediately (fail-fast)

**Alternative: Shell script approach** (if you don't want to implement ContextResolver):

```bash
#!/bin/bash
# migrate-all-workspaces.sh

# Get all workspace IDs from main database
WORKSPACE_IDS=$(mysql -u user -p -D exampleMain -e "SELECT _id FROM workspace" -N)

# Migrate each workspace database
for workspaceId in $WORKSPACE_IDS; do
  echo "Migrating workspace: $workspaceId"

  @datacapy/migrate --config ./migrate.config.js \
    --datasource workspace \
    --context workspaceId=$workspaceId

  if [ $? -ne 0 ]; then
    echo "Failed to migrate workspace $workspaceId"
    exit 1
  fi
done

echo "All workspaces migrated successfully"
```

### Mixed Datasource Patches

A single migration directory can contain patches for multiple datasources:

```
migrate/
└── 2024/
    └── 02/
        ├── 2024-02-05_1000_init-main-indexes.ts    # dataSourceName: 'db'
        ├── 2024-02-05_1100_init-workspace-indexes.ts    # dataSourceName: 'workspace'
        └── 2024-02-05_1200_seed-main-data.ts       # dataSourceName: 'db'
```

When you run migrations for a specific datasource, only patches matching that datasource are executed:

```bash
# Only executes patches with dataSourceName: 'db'
@datacapy/migrate --config ./migrate.config.js --datasource db

# Only executes patches with dataSourceName: 'workspace'
@datacapy/migrate --config ./migrate.config.js --datasource workspace --context workspaceId=abc123
```

## Dynamic Context Resolution

### Using Context in Patches

Access context-specific data in your migrations:

```typescript
export default class WorkspaceMigration implements DatabasePatchInterface {
  version = "2024-02-06_1000";
  description = "Migrate workspace-specific data";
  dataSourceName = "workspace";

  async update(modelManager: ModelManager): Promise<void> {
    // Repos are pre-wired to the workspace's actual datasource by the migration runner
    const repo = modelManager.getRepo("survey");

    console.log("Migrating workspace surveys...");

    // Perform migration
    await repo.updateMany({}, { $set: { status: "active" } });
  }
}
```

### Multiple Context Values

```bash
# Provide multiple context values
@datacapy/migrate --config ./migrate.config.js \
  --datasource workspace \
  --context workspaceId=abc123 \
  --context workspaceId=xyz789
```

## Related Documentation

- [Advanced Usage Index](./index.md)
- [Custom Workflows](./custom-workflows.md)
- [Troubleshooting](./troubleshooting.md)
