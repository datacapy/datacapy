---
"mzen-server": patch
---

`BodyParserConfigurer`'s `raw` content-type option now actually uses `body-parser`'s `raw()` middleware instead of `text()` - previously any endpoint enabling `raw: { enable: true }` would get a UTF-8-decoded string body instead of a `Buffer`, silently the wrong data type for anything needing the exact raw bytes (e.g. a webhook signature check). Also fixed `raw`'s fallback default (when no `raw` config is given at all) to use `rawDefault` instead of `textDefault` - harmless today since both currently have identical values, but wrong if they ever diverge.
