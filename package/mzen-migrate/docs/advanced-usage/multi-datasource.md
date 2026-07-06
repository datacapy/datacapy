# Multi-Datasource Migrations and Dynamic Context Resolution

## Multi-Datasource Migrations

### Migrating Multiple Datasources

mzen-migrate supports migrating multiple independent datasources. Each datasource maintains its own migration history.

#### Account-Level Database

```bash
# Migrate main account database
mzen-migrate --config ./migrate.config.js --datasource db
```

Patches targeting this datasource:

```typescript
export default class InitAccountIndexes implements DatabasePatchInterface {
  version = "2024-02-05_1000";
  description = "Initialize account-level indexes";
  dataSourceName = "db"; // Targets account database

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");
    // Migrate account database
  }
}
```

#### Project-Specific Databases

```bash
# Migrate specific project database
mzen-migrate --config ./migrate.config.js \
  --datasource project \
  --context projectId=abc123
```

Patches targeting project datasources:

```typescript
export default class AddProjectFeature implements DatabasePatchInterface {
  version = "2024-02-05_1100";
  description = "Add feature to project database";
  dataSourceName = "project"; // Targets project database

  async update(modelManager: ModelManager): Promise<void> {
    // Repos are pre-wired to the project's actual datasource by the migration runner
    const repo = modelManager.getRepo("myRepo");
    // Migrate this specific project's database
  }
}
```

#### Migrating All Projects (Wildcard Pattern)

Use the context lookup feature to migrate all projects with a single command:

```bash
# Migrate all project databases sequentially
mzen-migrate --config ./migrate.config.js \
  --datasource project \
  --context-lookup "*"

# With dry-run to preview
mzen-migrate --config ./migrate.config.js \
  --datasource project \
  --context-lookup "*" \
  --dry-run
```

This requires implementing a `ContextResolver` in your application's configuration:

```typescript
// migrate.config.js
import { ContextResolverProject } from "./src/context/ContextResolverProject";
import { modelManager } from "./src/model-manager";

export default async () => {
  await modelManager.init();

  // Create context resolver for wildcard pattern support
  const accountDataSource = modelManager.getDataSource("db");
  const contextResolver = new ContextResolverProject(accountDataSource);

  return {
    modelManager,
    contextResolver, // Enable context lookup patterns
    patchDirectory: "./migrate",
  };
};
```

**ContextResolver implementation example:**

```typescript
// src/context/ContextResolverProject.ts
import { ContextResolver } from "mzen-migrate";
import { DataSourceInterface } from "mzen-om";

export class ContextResolverProject implements ContextResolver {
  constructor(private accountDataSource: DataSourceInterface) {}

  async resolve(pattern: string): Promise<Array<Record<string, string>>> {
    if (pattern === "*") {
      // Query all projects from account database
      const projects = await this.accountDataSource.find("project", {});

      // Convert to context value objects
      return projects.map((project) => ({
        projectId: project._id,
      }));
    }

    // Support other patterns as needed
    throw new Error(`Unsupported context pattern: ${pattern}`);
  }
}
```

**How it works:**

1. The `--context-lookup "*"` pattern is passed to the ContextResolver
2. The resolver queries the account database for all projects
3. MigrationManager runs migrations sequentially for each project (one at a time)
4. If any project fails, the process stops immediately (fail-fast)

**Alternative: Shell script approach** (if you don't want to implement ContextResolver):

```bash
#!/bin/bash
# migrate-all-projects.sh

# Get all project IDs from account database
PROJECT_IDS=$(mysql -u user -p -D veysurAccount -e "SELECT _id FROM project" -N)

# Migrate each project database
for projectId in $PROJECT_IDS; do
  echo "Migrating project: $projectId"

  mzen-migrate --config ./migrate.config.js \
    --datasource project \
    --context projectId=$projectId

  if [ $? -ne 0 ]; then
    echo "Failed to migrate project $projectId"
    exit 1
  fi
done

echo "All projects migrated successfully"
```

### Mixed Datasource Patches

A single migration directory can contain patches for multiple datasources:

```
migrate/
└── 2024/
    └── 02/
        ├── 2024-02-05_1000_init-account-indexes.ts    # dataSourceName: 'db'
        ├── 2024-02-05_1100_init-project-indexes.ts    # dataSourceName: 'project'
        └── 2024-02-05_1200_seed-account-data.ts       # dataSourceName: 'db'
```

When you run migrations for a specific datasource, only patches matching that datasource are executed:

```bash
# Only executes patches with dataSourceName: 'db'
mzen-migrate --config ./migrate.config.js --datasource db

# Only executes patches with dataSourceName: 'project'
mzen-migrate --config ./migrate.config.js --datasource project --context projectId=abc123
```

## Dynamic Context Resolution

### Using Context in Patches

Access context-specific data in your migrations:

```typescript
export default class ProjectMigration implements DatabasePatchInterface {
  version = "2024-02-06_1000";
  description = "Migrate project-specific data";
  dataSourceName = "project";

  async update(modelManager: ModelManager): Promise<void> {
    // Repos are pre-wired to the project's actual datasource by the migration runner
    const repo = modelManager.getRepo("survey");

    console.log("Migrating project surveys...");

    // Perform migration
    await repo.updateMany({}, { $set: { status: "active" } });
  }
}
```

### Multiple Context Values

```bash
# Provide multiple context values
mzen-migrate --config ./migrate.config.js \
  --datasource project \
  --context projectId=abc123 \
  --context tenantId=xyz789
```

## Related Documentation

- [Advanced Usage Index](./index.md)
- [Custom Workflows](./custom-workflows.md)
- [Troubleshooting](./troubleshooting.md)
