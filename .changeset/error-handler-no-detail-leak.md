---
"mzen-server": minor
---

`ErrorHandler` no longer returns a raw, unhandled exception's `message` to API clients by default - unhandled errors now get a generic "An unexpected error occurred" response message, while server-side logging (unaffected) still gets full detail. A host application can opt back in via the `exposeErrorDetails` constructor argument or the new `setExposeErrorDetails()` method (e.g. only outside production), since exception messages can otherwise leak internal detail such as DB error text or file paths to clients.
