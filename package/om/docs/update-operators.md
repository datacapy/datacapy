# Update Operators: MySQL DataSource

## Supported Operators

| Operator       | Description                                               |
| -------------- | --------------------------------------------------------- |
| `$set`         | Set one or more fields to given values                    |
| `$setOnInsert` | Set fields only when inserting (upsert)                   |
| `$unset`       | Remove one or more fields                                 |
| `$inc`         | Increment a numeric field                                 |
| `$push`        | Append a value to an array field                          |
| `$addToSet`    | Append a value only if not already present                |
| `$pop`         | Remove the first (`-1`) or last (`1`) element of an array |
| `$pull`        | Remove all elements equal to a scalar value               |
| `$pullAll`     | Remove all occurrences of each value in a list            |

## Usage Examples

```typescript
// $push: append one tag
await repo.updateOne({ id }, { $push: { tags: 'draft' } })

// $push $each: append multiple at once
await repo.updateOne(
  { id },
  { $push: { tags: { $each: ['draft', 'review'] } } }
)

// $addToSet: add role only if missing
await repo.updateOne({ id }, { $addToSet: { roles: 'editor' } })

// $pop: remove last element
await repo.updateOne({ id }, { $pop: { history: 1 } })

// $pop: remove first element
await repo.updateOne({ id }, { $pop: { history: -1 } })

// $pull: remove all elements equal to a value
await repo.updateOne({ id }, { $pull: { tags: 'obsolete' } })

// $pullAll: remove several values at once
await repo.updateOne({ id }, { $pullAll: { tags: ['obsolete', 'wip'] } })
```

## MySQL Version Requirement

`$pull` and `$pullAll` use `JSON_TABLE` and `MEMBER OF`, which require **MySQL
8.0+**. The other array operators (`$push`, `$addToSet`, `$pop`) work on MySQL
5.7+.

## Limitations

- **`$pull` only supports scalar matching.** Predicate-style pulls (e.g.
  `{ $pull: { items: { status: 'inactive' } } }`) throw an error. Use
  application-level filtering and `$set` to replace the array instead.
- **`$pop` on an empty array** is a no-op (the document is left unchanged).
- **`$addToSet` with `$each`** checks each candidate independently: each missing
  element is appended in order.

## Implementation

All operators are handled in `buildSetClause()` in
[`src/data-source/mysql/mysql-sql-builder.ts`](../src/data-source/mysql/mysql-sql-builder.ts).
Tests live in
[`src/data-source/mysql/mysql-sql-builder/update.test.ts`](../src/data-source/mysql/mysql-sql-builder/update.test.ts).
