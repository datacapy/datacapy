# Testing Migrations, Rollback Strategy, and Production Checklist

## Testing Migrations

### Unit Testing

```typescript
// __tests__/migrations/2024-02-05_1000.test.ts
import AddUsersTable from "../migrate/2024/02/2024-02-05_1000_add-users-table";
import { DataSourceMock } from "mzen-om";

describe("AddUsersTable Migration", () => {
  it("should have correct version", () => {
    const migration = new AddUsersTable();
    expect(migration.version).toBe("2024-02-05_1000");
  });

  it("should create users table", async () => {
    const mockDS = new DataSourceMock({});
    const mockMM = createMockModelManager(mockDS);

    const migration = new AddUsersTable();
    await migration.update(mockMM);

    expect(mockDS.dataInsert).toHaveLength(1);
    expect(mockDS.dataInsert[0].collection).toBe("users");
  });

  it("should be idempotent", async () => {
    const mockDS = new DataSourceMock({});
    const mockMM = createMockModelManager(mockDS);

    const migration = new AddUsersTable();

    // Run twice
    await migration.update(mockMM);
    await migration.update(mockMM);

    // Should handle gracefully
    expect(mockDS.dataInsert).toHaveLength(1);
  });
});
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
  version = "2024-02-05_1430";
  description = "Add user roles";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("role");
    await repo.insertMany([
      { name: "admin", permissions: ["*"] },
      { name: "editor", permissions: ["read", "write"] },
    ]);
  }
}

// Reverse: 2024-02-05_1600_remove-user-roles.ts
export default class RemoveUserRoles implements DatabasePatchInterface {
  version = "2024-02-05_1600";
  description = "Remove user roles (rollback of 1430)";
  dataSourceName = "db";

  async update(modelManager: ModelManager): Promise<void> {
    const repo = modelManager.getRepo("role");
    await repo.deleteMany({ name: { $in: ["admin", "editor"] } });
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

## Related Documentation

- [Best Practices Index](./index.md)
- [Golden Rules: DO](./dos.md)
- [Golden Rules: DON'T](./donts.md)
- [Common Patterns](./common-patterns.md)
