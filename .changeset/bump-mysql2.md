---
"mzen-om": patch
---

Bump `mysql2` to `^3.23.1` to close two advisories present in the previously-pinned `^3.20.0` range: an auth-plugin downgrade to `mysql_clear_password` that could leak plaintext credentials, and an unbounded zlib inflate in the compressed MySQL protocol handler allowing a decompression-bomb DoS.
