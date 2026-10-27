---
'@datacapy/schema': patch
---

Fix two validation bugs. The `stripHtml` filter took quadratic time on input with many unclosed `<` characters (100,000 of them blocked the event loop for over a minute), and because filters run before validators, a `maxLength` constraint did not prevent it. It now ignores everything after the last `>` and returns the same output as before. The `valueLength` validator rejected every number against `min` and `max` because its number comparison was inverted, and it ignored a limit of `0`. Numbers are now compared by value (`NaN` is rejected) and `min: 0` and `max: 0` are enforced.
