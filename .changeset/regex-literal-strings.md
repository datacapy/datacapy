---
"@datacapy/om": minor
---

Breaking: a string `$regex` operand is now a literal substring match instead of a regex. Regex syntax and the LIKE wildcards `%` and `_` in it are matched literally, so untrusted search text is safe to pass without escaping. Pass a `RegExp` object to opt in to real regex semantics.
