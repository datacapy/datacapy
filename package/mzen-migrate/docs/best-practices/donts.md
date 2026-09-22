# Golden Rules: DON'T

#### 1. Don't Modify Existing Migrations

```typescript
// ❌ Bad - Modifying existing migration
// File: 2024-02-05_1000_init-indexes.ts (already applied in production)
export default class InitIndexes implements DatabasePatchInterface {
  version = "2024-02-05_1000";
  description = "Initialize indexes";

  async update(modelManager: ModelManager): Promise<void> {
    // Adding new logic to already-applied migration
    await createNewIndexes(); // ❌ Don't do this!
  }
}

// ✅ Good - Create new migration
// File: 2024-02-06_1000_add-additional-indexes.ts
export default class AddAdditionalIndexes implements DatabasePatchInterface {
  version = "2024-02-06_1000";
  description = "Add additional indexes";

  async update(modelManager: ModelManager): Promise<void> {
    await createNewIndexes(); // ✅ New migration
  }
}
```

**Why?** Existing migrations may have already run in production. Modifying them won't re-run them.

#### 2. Don't Use Sequential Numbers

```typescript
// ❌ Bad
version = "001";
version = "002";

// ✅ Good
version = "2024-02-05_1000";
version = "2024-02-05_1001";
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
  email: "admin@example.com",
  password: "password123", // ❌ Hardcoded password
  apiKey: "sk_live_abc123", // ❌ Hardcoded API key
});

// ✅ Good
import { hashPassword } from "../utils/crypto";

await repo.create({
  email: "admin@example.com",
  password: await hashPassword(process.env.ADMIN_PASSWORD),
  apiKey: process.env.API_KEY,
});
```

#### 6. Don't Load Large Datasets Into Memory

```typescript
// ❌ Bad - Loads all records into memory
async update(modelManager: ModelManager): Promise<void> {
  const repo = modelManager.getRepo('user')
  const allUsers = await repo.find({}) // Could be millions!

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

**Which option to use:**

- **Every matched document gets the same value** (a static field, or an update built entirely from operators like `$set`/`$inc`/`$unset`) → use a single `repo.updateMany(update, filter)` call. This runs entirely on the database server: no documents cross the network, and there's only one round trip regardless of collection size.
- **Each document needs a different, computed value** (e.g. normalising per-document text, or logic that depends on external data) → use `repo.bulkWrite([...])` to submit a mixed batch of `insertOne`/`updateOne`/`updateMany`/`deleteOne`/`deleteMany` ops in one call, instead of one `updateOne` round trip per document:

  ```typescript
  await repo.bulkWrite(
    users.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { normalizedName: normalize(user.name) } },
      },
    })),
  );
  ```

  `bulkWrite` is `ordered`-only (it stops and rolls back at the first failing op; there's no partial-success mode) and, on MySQL, cannot always identify which op in the batch failed if one does. It doesn't replace the pagination advice above: `find()` still has no cursor, so building a very large ops array still means resolving the full page into memory first: page through with a bounded `limit` and call `bulkWrite` once per page. See [Data Transformation](./common-patterns.md#pattern-data-transformation) below for a worked example, including how to bound the damage when that round-trip count is large.

- **Never** call `repo.find({})` with no `limit` on a collection that isn't known to be small: see the `find()` API reference in [`README.md`](../../README.md#writing-patches) for the `skip`/`limit` options.

## Related Documentation

- [Best Practices Index](./index.md)
- [Golden Rules: DO](./dos.md)
- [Common Patterns](./common-patterns.md)
