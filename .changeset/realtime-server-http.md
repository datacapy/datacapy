---
"@datacapy/server": minor
---

Create the `http.Server` up front so `server.server` is available in every init stage, destroy open connections on shutdown so live WebSockets do not delay it, and tolerate an already-closed server.
