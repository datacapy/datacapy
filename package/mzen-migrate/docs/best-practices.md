# Migration Best Practices

## Overview

This document provides guidelines for writing effective, safe, and maintainable database migrations using mzen-migrate.

## Golden Rules

### ✅ DO

#### 1. Always Test with Dry-Run First

```bash
# Preview changes before applying
mzen-migrate --config ./migrate.config.js --datasource db --dry-run
```

#### 2. Make Migrations Idempotent

Migrations should be safe to run multiple times. Check if operation already applied before executing:

```typescript
export default class IdempotentMigration implements DatabasePatchInterface {
  version = '2024-02-05_1430'
  description = 'Idempotent data seed'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('subscription')

    // Check if already seeded
    const existingCount = await repo.count({})
    if (existingCount > 0) {
      console.log(`⚠ Found ${existingCount} existing records, skipping seed`)
      return
    }

    // Safe to seed
    for (const data of SEED_DATA) {
      await repo.create(data)
    }
  }
}
```

**Idempotency Patterns:**

**Pattern 1: Check Before Create**
```typescript
const existing = await repo.findOne({ code: 'FREE' })
if (existing) {
  console.log('⚠ Already exists, skipping')
  return
}
await repo.create({ code: 'FREE', name: 'Free' })
```

**Pattern 2: Count Check**
```typescript
const count = await repo.count({ type: 'admin' })
if (count > 0) {
  console.log(`⚠ Found ${count} existing records, skipping`)
  return
}
// Seed data
```

**Pattern 3: Try-Catch**
```typescript
try {
  await repo.createIndexes()
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('⚠ Indexes already exist')
  } else {
    throw error
  }
}
```

**Pattern 4: Upsert**
```typescript
// Update if exists, insert if not
for (const data of seedData) {
  await repo.updateOne(
    data,
    { code: data.code },
    { upsert: true }
  )
}
```

#### 3. Use Descriptive Names and Comments

```typescript
// ✅ Good
export default class AddUserRoles implements DatabasePatchInterface {
  version = '2024-02-05_1430'
  description = 'Add user roles table and seed default roles'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    console.log('Creating user roles...')
    // Migration logic
  }
}

// ❌ Bad
export default class Update implements DatabasePatchInterface {
  version = '2024-02-05_1430'
  description = 'Update'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    // No logging or comments
  }
}
```

**File Naming:**
```
✓ 2024-02-05_1430_add-user-roles.ts
✓ 2024-02-06_1000_add-user-email-index.ts
✓ 2024-02-07_1400_seed-default-roles.ts

✗ 2024-02-05_1430_patch1.ts
✗ 2024-02-06_1000_update.ts
✗ 2024-02-07_1400_fix.ts
```

#### 4. Log Progress Clearly

```typescript
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')

  console.log('Starting user migration...')

  const users = await repo.findAll({})
  console.log(`Found ${users.length} users to update`)

  let updated = 0
  for (const user of users) {
    if (needsUpdate(user)) {
      await repo.updateOne({ /* ... */ }, { _id: user._id })
      updated++
    }
  }

  console.log(`✓ Updated ${updated} users successfully`)
}
```

#### 5. Handle Errors Gracefully

```typescript
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')

  try {
    await repo.createIndexes()
    console.log('✓ Indexes created successfully')
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠ Index already exists, continuing...')
    } else if (error.message.includes('Duplicate')) {
      console.log('⚠ Duplicate key error, skipping...')
    } else {
      // Re-throw for rollback
      console.error('✗ Failed to create indexes:', error.message)
      throw error
    }
  }
}
```

#### 6. Version Chronologically

```typescript
// Use actual date/time when creating
const now = new Date()
const version = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '')
// Results in: 2024-02-05_1430
```

Never modify version after committing to source control.

#### 7. Keep Patches Atomic

Each patch should do one thing and be reversible if needed:

```typescript
// ✅ Good - Single, clear purpose
export default class AddUserEmailIndex implements DatabasePatchInterface {
  version = '2024-02-10_1000'
  description = 'Add index on users.email for faster lookups'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource('db')
    await db.createIndex('users', { email: 1 }, {
      name: 'idx_users_email',
      unique: true
    })
  }
}

// ❌ Bad - Multiple unrelated changes
export default class MiscChanges implements DatabasePatchInterface {
  version = '2024-02-10_1100'
  description = 'Add indexes, update roles, and seed data'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    // Creating indexes
    await createIndexes()
    // Updating roles
    await updateRoles()
    // Seeding data
    await seedData()
    // Too much in one patch!
  }
}
```

#### 8. Commit Patches to Version Control

Patches should be committed to Git for:
- Team coordination
- Deployment automation
- Audit trail
- Rollback capability

### ❌ DON'T

#### 1. Don't Modify Existing Migrations

```typescript
// ❌ Bad - Modifying existing migration
// File: 2024-02-05_1000_init-indexes.ts (already applied in production)
export default class InitIndexes implements DatabasePatchInterface {
  version = '2024-02-05_1000'
  description = 'Initialize indexes'

  async update(modelManager: ModelManager): Promise<void> {
    // Adding new logic to already-applied migration
    await createNewIndexes() // ❌ Don't do this!
  }
}

// ✅ Good - Create new migration
// File: 2024-02-06_1000_add-additional-indexes.ts
export default class AddAdditionalIndexes implements DatabasePatchInterface {
  version = '2024-02-06_1000'
  description = 'Add additional indexes'

  async update(modelManager: ModelManager): Promise<void> {
    await createNewIndexes() // ✅ New migration
  }
}
```

**Why?** Existing migrations may have already run in production. Modifying them won't re-run them.

#### 2. Don't Use Sequential Numbers

```typescript
// ❌ Bad
version = '001'
version = '002'

// ✅ Good
version = '2024-02-05_1000'
version = '2024-02-05_1001'
```

**Why?** Timestamps eliminate merge conflicts and provide chronological context.

#### 3. Don't Skip Error Handling

```typescript
// ❌ Bad - No error handling
async update(modelManager: ModelManager): Promise<void> {
  await repo.createIndexes()
  await repo.insertMany(data)
  // What if these fail?
}

// ✅ Good - Proper error handling
async update(modelManager: ModelManager): Promise<void> {
  try {
    await repo.createIndexes()
    console.log('✓ Indexes created')
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠ Indexes already exist')
    } else {
      throw error
    }
  }

  try {
    await repo.insertMany(data)
    console.log('✓ Data seeded')
  } catch (error) {
    console.error('✗ Failed to seed data:', error.message)
    throw error
  }
}
```

#### 4. Don't Make Destructive Changes Without Safeguards

```typescript
// ❌ Bad - No safeguards
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')
  await repo.deleteMany({ status: 'inactive' })
}

// ✅ Good - With safeguards
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')

  // Document risk
  console.log('⚠ This migration deletes inactive users')
  console.log('⚠ Ensure you have a backup before proceeding')

  // Add safety check
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    throw new Error('Manual confirmation required in production')
  }

  // Count before deleting
  const count = await repo.count({ status: 'inactive' })
  console.log(`Will delete ${count} inactive users`)

  // Perform deletion
  await repo.deleteMany({ status: 'inactive' })
  console.log(`✓ Deleted ${count} inactive users`)
}
```

#### 5. Don't Hardcode Sensitive Data

```typescript
// ❌ Bad
await repo.create({
  email: 'admin@example.com',
  password: 'password123',  // ❌ Hardcoded password
  apiKey: 'sk_live_abc123'  // ❌ Hardcoded API key
})

// ✅ Good
import { hashPassword } from '../utils/crypto'

await repo.create({
  email: 'admin@example.com',
  password: await hashPassword(process.env.ADMIN_PASSWORD),
  apiKey: process.env.API_KEY
})
```

#### 6. Don't Load Large Datasets Into Memory

```typescript
// ❌ Bad - Loads all records into memory
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')
  const allUsers = await repo.findAll({}) // Could be millions!

  for (const user of allUsers) {
    await repo.updateOne({ newField: 'value' }, { _id: user._id })
  }
}

// ✅ Good - Batch processing
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')

  // Option 1: Bulk update
  await repo.updateMany(
    { newField: 'value' },
    { newField: { $exists: false } }
  )

  // Option 2: Paginated processing
  let skip = 0
  const limit = 1000

  while (true) {
    const batch = await repo.find({}, { skip, limit })
    if (batch.length === 0) break

    for (const user of batch) {
      await processUser(user)
    }

    skip += limit
    console.log(`Processed ${skip} users...`)
  }
}
```

## Testing Migrations

### Unit Testing

```typescript
// __tests__/migrations/2024-02-05_1000.test.ts
import AddUsersTable from '../migrate/2024/02/2024-02-05_1000_add-users-table'
import { DataSourceMock } from 'mzen-om'

describe('AddUsersTable Migration', () => {
  it('should have correct version', () => {
    const migration = new AddUsersTable()
    expect(migration.version).toBe('2024-02-05_1000')
  })

  it('should create users table', async () => {
    const mockDS = new DataSourceMock({})
    const mockMM = createMockModelManager(mockDS)

    const migration = new AddUsersTable()
    await migration.update(mockMM)

    expect(mockDS.dataInsert).toHaveLength(1)
    expect(mockDS.dataInsert[0].collection).toBe('users')
  })

  it('should be idempotent', async () => {
    const mockDS = new DataSourceMock({})
    const mockMM = createMockModelManager(mockDS)

    const migration = new AddUsersTable()

    // Run twice
    await migration.update(mockMM)
    await migration.update(mockMM)

    // Should handle gracefully
    expect(mockDS.dataInsert).toHaveLength(1)
  })
})
```

### Integration Testing

```bash
#!/bin/bash
# test-migrations.sh

# 1. Setup test database
docker run -d --name test-mysql -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 mysql:8

# 2. Wait for ready
sleep 10

# 3. Run migrations
MYSQL_HOST=localhost MYSQL_PORT=3307 mzen-migrate --config ./migrate.config.js --datasource db

# 4. Verify results
mysql -h localhost -P 3307 -u root -ptest -e "SELECT * FROM migrationMeta"

# 5. Cleanup
docker stop test-mysql && docker rm test-mysql
```

## Rollback Strategy

Migrations are forward-only. For rollback scenarios:

### 1. Database Backup Before Migrations

```bash
# Before running migrations in production
mysqldump -u user -p database > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
mzen-migrate --config ./migrate.config.js --datasource db

# If issues occur, restore
mysql -u user -p database < backup_20240205_143000.sql
```

### 2. Create Reverse Migration

```typescript
// Original: 2024-02-05_1430_add-user-roles.ts
export default class AddUserRoles implements DatabasePatchInterface {
  version = '2024-02-05_1430'
  description = 'Add user roles'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('role')
    await repo.insertMany([
      { name: 'admin', permissions: ['*'] },
      { name: 'editor', permissions: ['read', 'write'] }
    ])
  }
}

// Reverse: 2024-02-05_1600_remove-user-roles.ts
export default class RemoveUserRoles implements DatabasePatchInterface {
  version = '2024-02-05_1600'
  description = 'Remove user roles (rollback of 1430)'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('role')
    await repo.deleteMany({ name: { $in: ['admin', 'editor'] } })
  }
}
```

## Production Checklist

Before running migrations in production:

- [ ] Backup database
- [ ] Test migration in staging environment
- [ ] Run dry-run in production
- [ ] Schedule during maintenance window
- [ ] Notify team
- [ ] Monitor application after migration
- [ ] Have rollback plan ready
- [ ] Keep logs for audit trail

## Common Patterns

### Pattern: Repository Index Creation

```typescript
export default class InitIndexes implements DatabasePatchInterface {
  version = '2024-02-05_1000'
  description = 'Initialize indexes for all repositories'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repoNames = ['user', 'project', 'subscription']

    for (const repoName of repoNames) {
      try {
        const repo = modelManager.getRepo(repoName)
        console.log(`Creating indexes for ${repoName}...`)
        await repo.createIndexes()
        console.log(`✓ Indexes created for ${repoName}`)
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠ Some indexes for ${repoName} already exist`)
        } else {
          throw error
        }
      }
    }
  }
}
```

### Pattern: Data Seed with Constants

```typescript
import { INITIAL_SUBSCRIPTIONS } from '../constants'

export default class SeedSubscriptions implements DatabasePatchInterface {
  version = '2024-02-05_1001'
  description = 'Seed initial subscription tiers'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('subscription')

    // Check if already seeded
    const count = await repo.count({})
    if (count > 0) {
      console.log(`⚠ Found ${count} existing subscriptions, skipping`)
      return
    }

    // Seed data
    console.log(`Seeding ${INITIAL_SUBSCRIPTIONS.length} subscriptions...`)
    for (const data of INITIAL_SUBSCRIPTIONS) {
      await repo.create(data)
      console.log(`✓ Created: ${data.code}`)
    }
  }
}
```

### Pattern: Field Addition with Default

```typescript
export default class AddUserPreferences implements DatabasePatchInterface {
  version = '2024-02-05_1600'
  description = 'Add preferences field to existing users'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('user')

    // Count users without preferences
    const count = await repo.count({ preferences: { $exists: false } })
    console.log(`Adding preferences to ${count} users...`)

    // Update all users without preferences
    const result = await repo.updateMany(
      { preferences: { theme: 'light', notifications: true } },
      { preferences: { $exists: false } }
    )

    console.log(`✓ Added preferences to ${result.modifiedCount} users`)
  }
}
```

### Pattern: Data Transformation

```typescript
export default class NormalizeEmails implements DatabasePatchInterface {
  version = '2024-02-05_1700'
  description = 'Normalize email addresses to lowercase'
  dataSourceName = 'db'

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo('user')

    // Find users with uppercase emails
    const users = await repo.findAll({})

    let updated = 0
    for (const user of users) {
      const normalizedEmail = user.email.toLowerCase()

      if (user.email !== normalizedEmail) {
        await repo.updateOne(
          { email: normalizedEmail },
          { _id: user._id }
        )
        updated++
      }
    }

    console.log(`✓ Normalized ${updated} email addresses`)
  }
}
```

## Summary

Follow these best practices to create safe, maintainable migrations:

1. ✅ Always dry-run first
2. ✅ Make migrations idempotent
3. ✅ Use descriptive names
4. ✅ Log progress clearly
5. ✅ Handle errors gracefully
6. ✅ Version chronologically
7. ✅ Keep patches atomic
8. ✅ Commit to version control
9. ❌ Don't modify existing migrations
10. ❌ Don't hardcode sensitive data

For more information, see:
- [Architecture Documentation](./architecture.md)
- [Advanced Usage](./advanced-usage.md)
- [Main README](../README.md)
