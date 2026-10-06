---
"@datacapy/om": patch
---

Share the query context with relation population instead of deep-copying it. The context holds the transaction lease and its database connection, and copying it threw on Node 26, where socket properties are read-only, so any populate inside a transaction failed.
