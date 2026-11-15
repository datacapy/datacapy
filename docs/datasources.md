# Datasources

| Datasource | How a document is stored                                                  |
| ---------- | ------------------------------------------------------------------------- |
| MongoDB    | Natively, as a document in a collection.                                  |
| MySQL      | As JSON in one column, with promoted fields as indexed generated columns. |
| Mock       | In memory, seeded with data. Serves reads; it does not keep writes.       |

The schema is enforced by the application on every datasource: DataCapy casts and validates before it
writes. "Document" does not mean "no schema".

## MySQL

Each repository is a table with a generated `_id` primary key and the document in a `JSON` column.
You promote a field you filter or sort on with `createIndex`, which adds a stored generated column and
an index:

```ts
await repo.createIndex({ email: 1 }, { name: 'idx_email' })
// ALTER TABLE user ADD COLUMN gen_email VARCHAR(255) GENERATED ALWAYS AS (JSON_VALUE(jdoc, '$.email')) STORED
// CREATE INDEX idx_email ON user (gen_email ASC)
```

- **Promoted fields use native-column plans.** A generated column with an index is a real indexed
  column, and the query translator emits its predicates against it.
- **Fields you have not promoted scan the JSON.** Without a generated column the translator extracts
  the value from the document for each row. Promote fields that you query at scale and check hot
  queries with `EXPLAIN`.
- **The costs are real.** Generated columns are stored, so each adds write cost and storage, and
  adding one to an existing table alters it.
- **Constraints:** DataCapy creates the primary key and any unique indexes you declare, not `NOT NULL`
  or foreign keys. Validation is in the application.
- **Transactions** use `repo.transaction()`, which holds one dedicated connection for the callback. See
  [Architecture](../package/om/docs/architecture.md#transactions).

Details and type hints for dates and numbers: [MySQL Indexes](../package/om/docs/mysql-indexes.md).
