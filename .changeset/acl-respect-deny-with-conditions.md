---
"mzen-server": patch
---

Fix `ServerAcl.isPermitted()` so a rule with `allow: false` correctly denies access even when the matched role assessor's `hasRole()` returns a conditions object (e.g. `projectOwner`/`projectAdmin`-style roles). Previously, the object-returning branch always treated the role as granted with those conditions, ignoring `rule.allow` entirely - so `{ allow: false, role: 'projectAdmin' }` had no effect if `projectAdmin`'s `hasRole()` matched. No shipped endpoint config combined `allow: false` with a conditional role, so this had no live impact, but it was a real latent gap in the rule-folding logic.
