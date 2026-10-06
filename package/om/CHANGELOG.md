# @datacapy/om

## 0.2.0

### Minor Changes

- b612078: Add `DataSourceRedis.duplicate(overrides?)`, which returns a new
  ioredis connection sharing the datasource options; `close()` quits all
  duplicates.

### Patch Changes

- e74dc02: Share the query context with relation population instead of
  deep-copying it. The context holds the transaction lease and its database
  connection, and copying it threw on Node 26, where socket properties are
  read-only, so any populate inside a transaction failed.
- b184196: Reject `__proto__`, `constructor` and `prototype` as path segments in
  `ObjectPathAccessor`, `SchemaIterator.mapField` and the Redis data source's
  nested update paths, closing the prototype-pollution code scanning alerts.
- Updated dependencies [b184196]
  - @datacapy/schema@0.1.1

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this
baseline starts changelog tracking via
[Changesets](https://github.com/changesets/changesets).
