---
"mzen-schema": minor
---

`FilterStripHtml` now sanitises attributes on allow-listed tags instead of preserving them verbatim. Previously, allow-listing a tag name (via `allowTags`) let its entire opening tag - including every attribute - survive unmodified, so `<a href="javascript:alert(1)">` or `<img onerror="alert(1)">` passed straight through once `a`/`img` was allow-listed. Event-handler attributes (`on*`) are now always stripped, and URI-bearing attributes (`href`, `src`, `action`, `formaction`, `poster`, `background`, `xlink:href`) are stripped unless their scheme is `http:`, `https:`, or `mailto:` (a relative/no-scheme value is still allowed). No current veysur schema passes a non-empty `allowTags`, so this closes a latent defect rather than a live one.
