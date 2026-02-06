# Advanced Usage

## Overview

This document covers advanced patterns, troubleshooting, and edge cases for mzen-migrate.

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
  version = '2024-02-05_1000'
  description = 'Initialize account-level indexes'
  dataSourceName = 'db'  // Targets account database

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource('db')
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
  version = '2024-02-05_1100'
  description = 'Add feature to project database'
  dataSourceName = 'project'  // Targets project database

  async update(modelManager: ModelManager): Promise<void> {
    // Context (projectId) is provided via CLI
    const projectDB = modelManager.getDataSource('project')
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
import { ContextResolverProject } from './src/context/ContextResolverProject'
import { modelManager } from './src/model-manager'

export default async () => {
  await modelManager.init()

  // Create context resolver for wildcard pattern support
  const accountDataSource = modelManager.getDataSource('db')
  const contextResolver = new ContextResolverProject(accountDataSource)

  return {
    modelManager,
    contextResolver,  // Enable context lookup patterns
    patchDirectory: './migrate',
  }
}
```

**ContextResolver implementation example:**

```typescript
// src/context/ContextResolverProject.ts
import { ContextResolver } from 'mzen-migrate'
import { DataSourceInterface } from 'mzen-om'

export class ContextResolverProject implements ContextResolver {
  constructor(private accountDataSource: DataSourceInterface) {}

  async resolve(pattern: string): Promise<Array<Record<string, string>>> {
    if (pattern === '*') {
      // Query all projects from account database
      const projects = await this.accountDataSource.find('project', {})

      // Convert to context value objects
      return projects.map(project => ({
        projectId: project._id
      }))
    }

    // Support other patterns as needed
    throw new Error(`Unsupported context pattern: ${pattern}`)
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
  version = '2024-02-06_1000'
  description = 'Migrate project-specific data'
  dataSourceName = 'project'

  async update(modelManager: ModelManager): Promise<void> {
    // Get the project datasource (resolved via CLI context)
    const projectDB = modelManager.getDataSource('project')

    // Optional: Access context information
    // (if your ModelManager exposes context)
    const projectId = modelManager.getContext('project')?.lookupKey

    console.log(`Migrating project: ${projectId}`)

    // Perform migration
    await projectDB.updateMany('surveys', {}, {
      $set: { status: 'active' }
    })
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

## Custom Migration Workflows

### Programmatic Usage

Instead of using the CLI, you can run migrations programmatically:

```typescript
import { MigrationManager } from 'mzen-migrate'
import modelManager from './model-manager'

async function runMigrations() {
  // Initialize ModelManager
  await modelManager.init()

  // Configure migration
  const config = {
    modelManager,
    dataSourceName: 'db',
    patchDirectory: './migrate',
    targetVersion: 'latest',
    dryRun: false,
    verbose: true,
    stopOnError: true,
  }

  // Run migration
  const manager = new MigrationManager(config)
  const result = await manager.migrate()

  // Handle result
  console.log(`Applied ${result.successCount} patches`)
  console.log(`Current version: ${result.currentVersion}`)

  if (result.failedCount > 0) {
    console.error('Migration failed!')
    result.patchResults.forEach(r => {
      if (r.status === 'failed') {
        console.error(`${r.version}: ${r.error?.message}`)
      }
    })
    process.exit(1)
  }

  // Cleanup
  await modelManager.shutdown()
}

runMigrations().catch(console.error)
```

### Custom Logger

```typescript
import { MigrationManager } from 'mzen-migrate'

const config = {
  modelManager,
  dataSourceName: 'db',
  patchDirectory: './migrate',
  logger: (message: string, level: 'info' | 'warn' | 'error') => {
    // Custom logging logic
    if (level === 'error') {
      myLogger.error(message)
    } else if (level === 'warn') {
      myLogger.warn(message)
    } else {
      myLogger.info(message)
    }
  }
}

const manager = new MigrationManager(config)
await manager.migrate()
```

### Conditional Migrations

```typescript
export default class ConditionalMigration implements DatabasePatchInterface {
  version = '2024-02-07_1000'
  description = 'Conditional feature migration'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const featureEnabled = process.env.ENABLE_FEATURE === 'true'

    if (!featureEnabled) {
      console.log('⚠ Feature disabled, skipping migration')
      return
    }

    console.log('Feature enabled, applying migration')
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
  version = '2024-02-08_1000'
  description = 'Create tables'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    // Create tables
    await createUserTable()
    await createRoleTable()
  }
}

// 2024-02-08_1001_create-indexes.ts
export default class CreateIndexes implements DatabasePatchInterface {
  version = '2024-02-08_1001'
  description = 'Create indexes (depends on 1000)'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    // This runs after 1000 due to version ordering
    await createIndexes()
  }
}
```

Version ordering ensures dependencies are respected: `1000` runs before `1001`.

### External Data Loading

```typescript
import { readFile } from 'fs/promises'
import path from 'path'

export default class LoadExternalData implements DatabasePatchInterface {
  version = '2024-02-09_1000'
  description = 'Load data from external file'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('product')

    // Load data from JSON file
    const dataPath = path.join(__dirname, '../data/products.json')
    const rawData = await readFile(dataPath, 'utf-8')
    const products = JSON.parse(rawData)

    // Validate data
    if (!Array.isArray(products)) {
      throw new Error('Invalid product data format')
    }

    // Insert products
    console.log(`Importing ${products.length} products...`)
    for (const product of products) {
      await repo.create(product)
    }

    console.log(`✓ Imported ${products.length} products`)
  }
}
```

### Progress Reporting

```typescript
export default class LargeMigration implements DatabasePatchInterface {
  version = '2024-02-10_1000'
  description = 'Large data migration with progress'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('user')

    const totalCount = await repo.count({})
    console.log(`Processing ${totalCount} users...`)

    let processed = 0
    let skip = 0
    const limit = 1000

    while (true) {
      const batch = await repo.find({}, { skip, limit })
      if (batch.length === 0) break

      for (const user of batch) {
        await processUser(user)
        processed++

        // Report progress every 100 users
        if (processed % 100 === 0) {
          const percent = ((processed / totalCount) * 100).toFixed(1)
          console.log(`Progress: ${processed}/${totalCount} (${percent}%)`)
        }
      }

      skip += limit
    }

    console.log(`✓ Processed ${processed} users`)
  }
}
```

### Validation Migrations

```typescript
export default class ValidateData implements DatabasePatchInterface {
  version = '2024-02-11_1000'
  description = 'Validate and fix data inconsistencies'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('user')

    // Find invalid records
    const invalidUsers = await repo.find({
      $or: [
        { email: { $exists: false } },
        { email: '' },
        { email: null }
      ]
    })

    if (invalidUsers.length > 0) {
      console.log(`⚠ Found ${invalidUsers.length} users with invalid emails`)

      // Option 1: Fix them
      for (const user of invalidUsers) {
        await repo.updateOne(
          { email: `user-${user._id}@example.com` },
          { _id: user._id }
        )
      }

      // Option 2: Delete them
      // await repo.deleteMany({ _id: { $in: invalidUsers.map(u => u._id) } })

      console.log(`✓ Fixed ${invalidUsers.length} users`)
    } else {
      console.log('✓ All users have valid emails')
    }
  }
}
```

## Troubleshooting

### "Datasource not found"

**Problem:** Cannot find datasource 'project'

**Cause:** Dynamic datasources need context to resolve

**Solution:**

```bash
# Provide context for dynamic datasources
mzen-migrate --config ./migrate.config.js \
  --datasource project \
  --context projectId=abc123
```

### "Duplicate key error"

**Problem:** Patch tries to insert data that already exists

**Cause:** Patch is not idempotent

**Solution:** Make patch idempotent

```typescript
// Check before inserting
const existing = await repo.findOne({ code: 'FREE' })
if (existing) {
  console.log('Already exists, skipping')
  return
}
await repo.create({ code: 'FREE', name: 'Free' })
```

### "Invalid version format"

**Problem:** Version doesn't match `YYYY-MM-DD_HHMM` format

**Cause:** Filename and version property don't match

**Solution:** Ensure they match exactly

```typescript
// Filename: 2024-02-05_1430_add-table.ts
export default class AddTable implements DatabasePatchInterface {
  version = '2024-02-05_1430'  // Must match filename
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
mzen-migrate --config ./migrate.config.js --datasource db --verbose

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
mzen-migrate --config ./migrate.config.js --datasource db --verbose

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

## Performance Optimization

### Batch Operations

```typescript
// ❌ Slow - Individual updates
for (const user of users) {
  await repo.updateOne({ status: 'active' }, { _id: user._id })
}

// ✅ Fast - Bulk update
await repo.updateMany(
  { status: 'active' },
  { status: { $exists: false } }
)
```

### Index Creation Timing

```typescript
export default class OptimizedIndexCreation implements DatabasePatchInterface {
  version = '2024-02-12_1000'
  description = 'Create indexes with optimization'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource('db')

    // Create indexes after data is loaded, not before
    // This is faster than creating indexes first and then inserting data

    console.log('Loading data...')
    await loadLargeDataset()

    console.log('Creating indexes (this may take a while)...')
    await db.createIndex('users', { email: 1 }, { unique: true })
    console.log('✓ Indexes created')
  }
}
```

### Parallel Processing

```typescript
export default class ParallelMigration implements DatabasePatchInterface {
  version = '2024-02-13_1000'
  description = 'Parallel data migration'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('user')

    // Process multiple batches in parallel
    const batchSize = 1000
    const totalCount = await repo.count({})
    const batches = Math.ceil(totalCount / batchSize)

    console.log(`Processing ${totalCount} users in ${batches} batches...`)

    const promises = []
    for (let i = 0; i < batches; i++) {
      const skip = i * batchSize
      promises.push(
        this.processBatch(repo, skip, batchSize)
      )
    }

    await Promise.all(promises)
    console.log(`✓ Processed ${totalCount} users`)
  }

  private async processBatch(repo, skip: number, limit: number) {
    const batch = await repo.find({}, { skip, limit })
    for (const user of batch) {
      await this.processUser(user)
    }
  }
}
```

## Testing Strategies

### Mock DataSource

```typescript
import { DataSourceMock } from 'mzen-om'
import { ModelManager } from 'mzen-om'

describe('Migration Tests', () => {
  it('should create indexes', async () => {
    // Create mock datasource
    const mockDS = new DataSourceMock({})

    // Create ModelManager with mock
    const modelManager = new ModelManager({})
    modelManager.addDataSource('db', mockDS)

    // Run migration
    const migration = new InitIndexes()
    await migration.update(modelManager)

    // Verify
    expect(mockDS.indexes).toHaveLength(3)
  })
})
```

### Integration Tests

```typescript
// test/integration/migrations.test.ts
import { MigrationManager } from 'mzen-migrate'
import { setupTestDatabase, teardownTestDatabase } from './helpers'

describe('Migration Integration Tests', () => {
  beforeEach(async () => {
    await setupTestDatabase()
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  it('should migrate from scratch', async () => {
    const manager = new MigrationManager({
      modelManager: testModelManager,
      dataSourceName: 'db',
      patchDirectory: './migrate',
    })

    const result = await manager.migrate()

    expect(result.successCount).toBeGreaterThan(0)
    expect(result.failedCount).toBe(0)
  })

  it('should be idempotent', async () => {
    const manager = new MigrationManager({
      modelManager: testModelManager,
      dataSourceName: 'db',
      patchDirectory: './migrate',
    })

    // Run twice
    await manager.migrate()
    const result = await manager.migrate()

    // Second run should have no patches to apply
    expect(result.successCount).toBe(0)
  })
})
```

## Deployment Integration

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy with Migrations

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Backup Database
        run: |
          mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME > backup.sql
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASS: ${{ secrets.DB_PASS }}
          DB_NAME: ${{ secrets.DB_NAME }}

      - name: Run Migrations (Dry Run)
        run: |
          pnpm mzen-migrate --config ./migrate.config.js --datasource db --dry-run

      - name: Run Migrations
        run: |
          pnpm mzen-migrate --config ./migrate.config.js --datasource db

      - name: Verify Application
        run: pnpm run test:integration
```

### Kubernetes Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
spec:
  ttlSecondsAfterFinished: 3600
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: myapp:latest
        command: ["pnpm", "mzen-migrate", "--config", "./migrate.config.js", "--datasource", "db"]
        envFrom:
        - configMapRef:
            name: db-config
        - secretRef:
            name: db-secrets
```

## Summary

Advanced patterns covered:

- ✅ Multi-datasource migrations
- ✅ Dynamic context resolution
- ✅ Custom workflows and programmatic usage
- ✅ Advanced patterns (dependencies, external data, progress reporting)
- ✅ Troubleshooting common issues
- ✅ Performance optimization
- ✅ Testing strategies
- ✅ Deployment integration

For more information, see:
- [Architecture Documentation](./architecture.md)
- [Best Practices](./best-practices.md)
- [Main README](../README.md)
