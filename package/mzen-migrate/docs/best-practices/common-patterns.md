# Common Patterns

### Pattern: Repository Index Creation

```typescript
export default class InitIndexes implements DatabasePatchInterface {
  version = "2024-02-05_1000";
  description = "Initialize indexes for all repositories";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repoNames = ["user", "project", "subscription"];

    for (const repoName of repoNames) {
      try {
        const repo = modelManager.getRepo(repoName);
        console.log(`Creating indexes for ${repoName}...`);
        await repo.createIndexes();
        console.log(`✓ Indexes created for ${repoName}`);
      } catch (error) {
        if (error.message.includes("already exists")) {
          console.log(`⚠ Some indexes for ${repoName} already exist`);
        } else {
          throw error;
        }
      }
    }
  }
}
```

### Pattern: Data Seed with Constants

```typescript
import { INITIAL_SUBSCRIPTIONS } from "../constants";

export default class SeedSubscriptions implements DatabasePatchInterface {
  version = "2024-02-05_1001";
  description = "Seed initial subscription tiers";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("subscription");

    // Check if already seeded
    const count = await repo.count({});
    if (count > 0) {
      console.log(`⚠ Found ${count} existing subscriptions, skipping`);
      return;
    }

    // Seed data
    console.log(`Seeding ${INITIAL_SUBSCRIPTIONS.length} subscriptions...`);
    for (const data of INITIAL_SUBSCRIPTIONS) {
      await repo.create(data);
      console.log(`✓ Created: ${data.code}`);
    }
  }
}
```

### Pattern: Field Addition with Default

```typescript
export default class AddUserPreferences implements DatabasePatchInterface {
  version = "2024-02-05_1600";
  description = "Add preferences field to existing users";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("user");

    // Count users without preferences
    const count = await repo.count({ preferences: { $exists: false } });
    console.log(`Adding preferences to ${count} users...`);

    // Update all users without preferences
    const result = await repo.updateMany(
      { preferences: { theme: "light", notifications: true } },
      { preferences: { $exists: false } },
    );

    console.log(`✓ Added preferences to ${result.modifiedCount} users`);
  }
}
```

### Pattern: Data Transformation

Each user's normalized email is a different computed value, so `updateMany` can't do this in one call — use `bulkWrite` to batch the per-document `updateOne` ops into a single round trip instead of issuing them one at a time. Page through with `skip`/`limit` so the working set stays bounded, rather than loading the whole collection at once:

```typescript
export default class NormalizeEmails implements DatabasePatchInterface {
  version = "2024-02-05_1700";
  description = "Normalize email addresses to lowercase";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("user");

    let updated = 0;
    let skip = 0;
    const limit = 1000;

    while (true) {
      const batch = await repo.find({}, { skip, limit });
      if (batch.length === 0) break;

      const ops = batch
        .filter((user) => user.email !== user.email.toLowerCase())
        .map((user) => ({
          updateOne: {
            filter: { _id: user._id },
            update: { email: user.email.toLowerCase() },
          },
        }));

      if (ops.length > 0) {
        await repo.bulkWrite(ops);
        updated += ops.length;
      }

      skip += limit;
    }

    console.log(`✓ Normalized ${updated} email addresses`);
  }
}
```

**Caveat:** since the update in each page can change the very field being sorted/matched on, re-running `find({}, { skip, limit })` after a write can shift which documents land on the next page (some get skipped, others repeated). Where the collection has a stable insertion-order field (e.g. `_id`), page by filtering on it (`{ _id: { $gt: lastSeenId } }`) instead of by numeric `skip`, so already-processed documents can't re-enter a later page.

**Caveat:** `bulkWrite` is ordered and stops at the first failing op — and on MySQL you can't always tell which op in the batch failed. Keep batch sizes reasonable (page-sized, as above) and expect an all-or-nothing failure per batch rather than partial success.

## Related Documentation

- [Best Practices Index](./index.md)
- [Golden Rules: DO](./dos.md)
- [Golden Rules: DON'T](./donts.md)
- [Testing and Rollback](./testing-and-rollback.md)
