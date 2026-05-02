# Upsert Operations

`upsertOne` and `upsertMany` atomically update matching documents or insert a
new document when no match is found.

## Methods

```typescript
repo.upsertOne(filter: QuerySelection, update: QueryUpdate): Promise<QueryPersistResultUpsert>
repo.upsertMany(filter: QuerySelection, update: QueryUpdate): Promise<QueryPersistResultUpsert>
```

Result shape:

```typescript
{
  count: number          // total documents affected
  upsertedCount: number  // 1 if a new document was inserted, 0 if existing was updated
  upsertedId?: any       // _id of the inserted document (upsertOne only)
}
```

## Supported update operators

| Operator       | Applied on update | Applied on insert |
| -------------- | ----------------- | ----------------- |
| `$set`         | yes               | yes               |
| `$setOnInsert` | **no**            | yes               |
| `$unset`       | yes               | —                 |
| `$inc`         | yes               | —                 |

## `$setOnInsert`

Fields under `$setOnInsert` are written only when the upsert results in a new
document. They are silently ignored on updates. Use this for fields that must
not be overwritten on subsequent upsert calls — typically `_id`, immutable
attributes, and `createdAt`.

**Example — currency rate cache:**

```typescript
async upsertRate(currency: string, rate: number): Promise<FxRate> {
  const now = new Date()
  await this.upsertOne(
    { currency },
    {
      $set: { rate, fetchedAt: now, source: 'ecb' },
      $setOnInsert: { _id: genUniqueId(), baseCurrency: 'GBP', currency },
    },
  )
  return (await this.findOne({ currency })) as FxRate
}
```

On first call: inserts
`{ _id, baseCurrency, currency, rate, fetchedAt, source }`.  
On subsequent calls: updates only `{ rate, fetchedAt, source }` — `_id` and
`baseCurrency` are preserved.

## How the insert document is built

When no matching document is found, the insert document is assembled as:

```
{ ...scalar fields from filter } + { ...$set } + { ...$setOnInsert }
```

Scalar equality fields from the filter (e.g. `{ currency: 'EUR' }`) are included
so the new document matches the filter. Complex filter operators (e.g.
`{ amount: { $gt: 10 } }`) are skipped.

## Data-source behaviour

All three data sources expose identical semantics:

- **MySQL** — attempts `UPDATE ... WHERE <filter>` first; on 0 rows affected,
  falls back to `INSERT`
- **Redis** — scans in-memory docs for a match; on miss, calls `insertOne`
- **MongoDB** — delegates to the driver's native `{ upsert: true }` option

`$setOnInsert` is handled correctly in all three: ignored in the UPDATE/patch
path, merged into the document on the INSERT path.
