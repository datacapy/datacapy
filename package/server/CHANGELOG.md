# @datacapy/server

## 0.3.0

### Minor Changes

- 356f3cd: Add `repib` (index) and `relb` (relation) builders. A repo's
  `indexes` and `relations` config accepts them directly, with no trailing
  `.build()`; plain config objects still work.
  `repib.desc('createdAt').timestamp()` sets the `TYPE_HINT_TIMESTAMP` hint Date
  index fields need, and `relb.hasMany('repo')` etc. replace the free-form
  relation `type` string. `RepoIndexConfig` also declares the `name` override it
  already read at runtime.

### Patch Changes

- Updated dependencies [356f3cd]
  - @datacapy/om@1.1.0

## 0.2.2

### Patch Changes

- Updated dependencies [3633ccc]
- Updated dependencies [7966276]
- Updated dependencies [f9d3f02]
  - @datacapy/om@1.0.0

## 0.2.1

### Patch Changes

- Updated dependencies [fe5ac90]
  - @datacapy/om@0.3.0

## 0.2.0

### Minor Changes

- 28db89d: Create the `http.Server` up front so `server.server` is available in
  every init stage, destroy open connections on shutdown so live WebSockets do
  not delay it, and tolerate an already-closed server.

### Patch Changes

- 16f9d01: Read `src: 'request'` values such as the Express `ip` getter through
  plain property access, since `ObjectPathAccessor` now only traverses own
  properties.
- Updated dependencies [e74dc02]
- Updated dependencies [b184196]
- Updated dependencies [b612078]
  - @datacapy/om@0.2.0

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this
baseline starts changelog tracking via
[Changesets](https://github.com/changesets/changesets).
