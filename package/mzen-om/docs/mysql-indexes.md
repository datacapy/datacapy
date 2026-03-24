# MySQL Indexes

## Generated Columns

MySQL stores documents as JSON in a `jdoc` column. Indexes on JSON fields are created via STORED generated columns that extract the value at write time, avoiding per-query JSON extraction overhead.

`createIndex` creates the generated column automatically if it doesn't exist:

```typescript
await repo.createIndex({ email: 1 }, { name: 'idx_email' })
// ALTER TABLE user ADD COLUMN gen_email VARCHAR(255) GENERATED ALWAYS AS (JSON_VALUE(jdoc, '$.email')) STORED
// CREATE INDEX idx_email ON user (gen_email ASC)
```

Generated column names follow the pattern `gen_<field>`, with dots replaced by underscores for nested fields (`address.city` → `gen_address_city`).

### Type hints

Use `typeHint` to control the column type for non-string fields:

```typescript
await repo.createIndex({ age: 1 }, { typeHint: 'int' })
await repo.createIndex({ price: 1 }, { typeHint: 'decimal' })
await repo.createIndex({ createdAt: 1 }, { typeHint: 'datetime' })
```

| typeHint | Column type | Expression |
|---|---|---|
| `string` (default) | `VARCHAR(255)` | `JSON_VALUE(jdoc, '$.field')` |
| `int` | `INT` | `JSON_VALUE(jdoc, '$.field')` |
| `decimal` | `DECIMAL(14,2)` | `JSON_VALUE(jdoc, '$.field')` |
| `date` | `DATE` | `STR_TO_DATE(LEFT(..., 10), '%Y-%m-%d')` |
| `datetime` | `DATETIME` | `STR_TO_DATE(LEFT(..., 19), '%Y-%m-%dT%H:%i:%s')` |
| `timestamp` | `TIMESTAMP(3)` | `STR_TO_DATE(LEFT(..., 19), '%Y-%m-%dT%H:%i:%s')` |

Per-field type hints for multi-field indexes:

```typescript
await repo.createIndex(
  { createdAt: 1, status: 1 },
  { typeHint: { createdAt: 'datetime', status: 'string' } }
)
```

---

## Case-Insensitive Search

### The problem

MySQL's `->>` JSON extraction returns values with `utf8mb4_bin` (binary) collation. This makes `LIKE` comparisons case-sensitive, even though `LIKE` is case-insensitive on regular table columns. A query like `{ email: { $regex: 'john', $options: 'i' } }` will fall back to `LOWER(jdoc->>'$.email') LIKE '%john%'` — correct, but it applies `LOWER()` to every row on every query.

### The solution: `lowercase: true`

Adding `lowercase: true` to `IndexOptions` creates a `gen_<field>_lower` column storing `LOWER(value)`:

```typescript
await repo.createIndex({ email: 1 }, { name: 'idx_email_lower', lowercase: true })
// ADD COLUMN gen_email_lower VARCHAR(255) GENERATED ALWAYS AS (LOWER(JSON_VALUE(jdoc, '$.email'))) STORED
// CREATE INDEX idx_email_lower ON user (gen_email_lower ASC)
```

Once the column exists, case-insensitive queries use it automatically — no code changes needed at the query site:

```typescript
// Query unchanged:
repo.find({ email: { $regex: 'john', $options: 'i' } })

// Without gen_email_lower:  LOWER(jdoc->>'$.email') LIKE '%john%'  — full scan, LOWER() per row
// With gen_email_lower:     `gen_email_lower` LIKE '%john%'        — indexed column, no runtime LOWER()
```

The same optimisation applies to `$like` and case-insensitive `RegExp` objects.

### Leading-wildcard limitation

`LIKE '%pattern%'` with a leading `%` cannot use a B-tree index regardless. The `lowercase` generated column still helps by:
- Eliminating per-row JSON extraction
- Eliminating per-row `LOWER()` evaluation
- Enabling prefix searches (`LIKE 'pattern%'`) to use the index

For full substring search at scale, consider a FULLTEXT index on the generated column.

### Operator behaviour summary

| Query operator | Generated column exists? | SQL emitted |
|---|---|---|
| `$regex` + `$options: 'i'` (simple literal) | Yes | `` `gen_field_lower` LIKE ? `` |
| `$regex` + `$options: 'i'` (simple literal) | No | `LOWER(jdoc->>'$.field') LIKE ?` |
| `$like` | Yes | `` `gen_field_lower` LIKE ? `` |
| `$like` | No | `LOWER(jdoc->>'$.field') LIKE ?` |
| `$regex` no options (simple literal) | — | `jdoc->>'$.field' LIKE BINARY ?` |
| `$regex` + `$options: 'i'` (complex pattern) | — | `jdoc->>'$.field' REGEXP '(?i)...'` |
| `=`, `IN`, `!=` | — | unchanged (always case-sensitive) |

### Example: user search

```typescript
// In repo setup / migration
await repo.createIndex({ email: 1 },     { name: 'idx_email_lower',     lowercase: true })
await repo.createIndex({ nameFirst: 1 }, { name: 'idx_name_first_lower', lowercase: true })
await repo.createIndex({ nameLast: 1 },  { name: 'idx_name_last_lower',  lowercase: true })

// Query — no changes needed
repo.find({
  $or: [
    { email:     { $regex: search, $options: 'i' } },
    { nameFirst: { $regex: search, $options: 'i' } },
    { nameLast:  { $regex: search, $options: 'i' } },
  ],
})
// Emits: (`gen_email_lower` LIKE ? OR `gen_nameFirst_lower` LIKE ? OR `gen_nameLast_lower` LIKE ?)
```
