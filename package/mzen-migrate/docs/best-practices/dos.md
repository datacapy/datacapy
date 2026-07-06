# Golden Rules: DO

#### 1. Always Test with Dry-Run First

```bash
# Preview changes before applying
mzen-migrate --config ./migrate.config.js --datasource db --dry-run
```

#### 2. Make Migrations Idempotent

Migrations should be safe to run multiple times. Check if operation already applied before executing:

```typescript
export default class IdempotentMigration implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Idempotent data seed";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("subscription");

    // Check if already seeded
    const existingCount = await repo.count({});
    if (existingCount > 0) {
      console.log(`⚠ Found ${existingCount} existing records, skipping seed`);
      return;
    }

    // Safe to seed
    for (const data of SEED_DATA) {
      await repo.create(data);
    }
  }
}
```

**Idempotency Patterns:**

**Pattern 1: Check Before Create**

```typescript
const existing = await repo.findOne({ code: "FREE" });
if (existing) {
  console.log("⚠ Already exists, skipping");
  return;
}
await repo.create({ code: "FREE", name: "Free" });
```

**Pattern 2: Count Check**

```typescript
const count = await repo.count({ type: "admin" });
if (count > 0) {
  console.log(`⚠ Found ${count} existing records, skipping`);
  return;
}
// Seed data
```

**Pattern 3: Try-Catch**

```typescript
try {
  await repo.createIndexes();
} catch (error) {
  if (error.message.includes("already exists")) {
    console.log("⚠ Indexes already exist");
  } else {
    throw error;
  }
}
```

**Pattern 4: Upsert**

```typescript
// Update if exists, insert if not
for (const data of seedData) {
  await repo.updateOne(data, { code: data.code }, { upsert: true });
}
```

#### 3. Use Descriptive Names and Comments

```typescript
// ✅ Good
export default class AddUserRoles implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Add user roles table and seed default roles";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    console.log("Creating user roles...");
    // Migration logic
  }
}

// ❌ Bad
export default class Update implements DatabasePatchInterface {
  version = "2024-02-05_1430";
  description = "Update";
  dataSourceName = "db";

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

  const users = await repo.find({})
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
const now = new Date();
const version = now
  .toISOString()
  .slice(0, 16)
  .replace("T", "_")
  .replace(":", "");
// Results in: 2024-02-05_1430
```

Never modify version after committing to source control.

#### 7. Keep Patches Atomic

Each patch should do one thing and be reversible if needed:

```typescript
// ✅ Good - Single, clear purpose
export default class AddUserEmailIndex implements DatabasePatchInterface {
  version = "2024-02-10_1000";
  description = "Add index on users.email for faster lookups";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const db = modelManager.getDataSource("db");
    await db.createIndex(
      "users",
      { email: 1 },
      {
        name: "idx_users_email",
        unique: true,
      },
    );
  }
}

// ❌ Bad - Multiple unrelated changes
export default class MiscChanges implements DatabasePatchInterface {
  version = "2024-02-10_1100";
  description = "Add indexes, update roles, and seed data";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    // Creating indexes
    await createIndexes();
    // Updating roles
    await updateRoles();
    // Seeding data
    await seedData();
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

## Related Documentation

- [Best Practices Index](./index.md)
- [Golden Rules: DON'T](./donts.md)
- [Common Patterns](./common-patterns.md)
