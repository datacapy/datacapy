# System Components

### 1. MigrationManager

**Purpose:** Orchestrate migration execution

**Workflow:**

```
1. Initialize
   ├── Resolve target datasource
   └── Initialize migrationMeta table

2. Scan
   ├── Discover patch files in directory
   ├── Filter by dataSourceName
   └── Sort by version chronologically

3. Plan
   ├── Get current version from migrationMeta
   ├── Determine target version
   └── Calculate patches to apply

4. Execute
   ├── For each patch:
   │   ├── Load patch class
   │   ├── Begin transaction
   │   ├── Call update(modelManager)
   │   ├── Commit or rollback
   │   └── Record in migrationMeta
   └── Return summary with counts, duration, errors

5. Report
   └── Return summary with counts, duration, errors
```

**Key Classes:**

- **MigrationManager** - Main orchestrator
- **PatchScanner** - Discovers migration files
- **PatchExecutor** - Executes patches
- **MetaTable** - Tracks applied migrations
- **VersionManager** - Handles version comparison
- **MigrationLogger** - Formatted output

### 2. Migration Patches

**Purpose:** Define individual database changes

**Interface:**

```typescript
interface DatabasePatchInterface {
  version: string; // Unique identifier (e.g., "2024-02-05_1000")
  description: string; // Human-readable description
  dataSourceName: string; // Target datasource ('db', 'workspace', etc.)
  update(modelManager: ModelManager): Promise<void>; // Migration logic
}
```

**File Structure:**

```
migrate/
└── 2024/                    # Year
    └── 02/                  # Month
        ├── 2024-02-05_1000_init-indexes.ts
        └── 2024-02-05_1001_data-seed.ts
```

**Naming Convention:**

- Format: `YYYY-MM-DD_HHMM_description.ts`
- Version in filename MUST match `version` property
- Chronological ordering by timestamp

### 3. Migration Tracking (migrationMeta Table)

**Purpose:** Track which migrations have been applied

**Schema:**

```javascript
{
  version: '2024-02-05_1430',          // Migration version (primary key)
  description: 'Add users table',      // Description
  appliedAt: new Date('2024-02-05...'), // Timestamp
  duration: 150                        // Execution time (ms)
}
```

**Example Data:**

| version         | description                 | appliedAt           | duration |
| --------------- | --------------------------- | ------------------- | -------- |
| 2024-02-05_1000 | Initialize database indexes | 2024-02-05 10:30:00 | 1245     |
| 2024-02-05_1001 | Seed subscription tiers     | 2024-02-05 10:30:02 | 523      |

## Related Documentation

- [Architecture Index](./index.md)
- [Execution Flow](./execution-flow.md)
- [Runtime Safety](./runtime-safety.md)
