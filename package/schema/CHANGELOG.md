# @datacapy/schema

## 0.2.0

### Minor Changes

- a3415b9: Breaking: an empty array is now a value, not a missing one. The
  `default` filter only applies to `undefined` and `null`, so an explicit `[]`
  is kept on a field with a configured default. A missing array field still
  takes the configured default, or `[]` when none is set.

## 0.1.1

### Patch Changes

- b184196: Reject `__proto__`, `constructor` and `prototype` as path segments in
  `ObjectPathAccessor`, `SchemaIterator.mapField` and the Redis data source's
  nested update paths, closing the prototype-pollution code scanning alerts.

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this
baseline starts changelog tracking via
[Changesets](https://github.com/changesets/changesets).
