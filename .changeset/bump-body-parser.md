---
"mzen-server": patch
---

Bump `body-parser` to `^2.3.0` to close an advisory in the previously-pinned `^2.2.2` range where an invalid `limit` value silently disabled body-size-limit enforcement entirely instead of falling back to a safe default.
