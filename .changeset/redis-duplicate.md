---
"@datacapy/om": minor
---

Add `DataSourceRedis.duplicate(overrides?)`, which returns a new ioredis connection sharing the datasource options; `close()` quits all duplicates.
