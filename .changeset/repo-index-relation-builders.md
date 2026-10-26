---
'@datacapy/om': minor
'@datacapy/server': minor
---

Add `repib` (index) and `relb` (relation) builders. A repo's `indexes` and `relations` config accepts them directly, with no trailing `.build()`; plain config objects still work. `repib.desc('createdAt').timestamp()` sets the `TYPE_HINT_TIMESTAMP` hint Date index fields need, and `relb.hasMany('repo')` etc. replace the free-form relation `type` string. `RepoIndexConfig` also declares the `name` override it already read at runtime.
