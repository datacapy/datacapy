---
'@datacapy/schema': minor
---

Tighten type casting and fix several validators.

- Date: `''`, strings that cannot be parsed, Invalid Date, NaN timestamps and impossible calendar days such as `2026-02-30` are cast errors. The keyword `'now'` still gives the current time.
- Boolean: accepts `true`, `false`, `1`, `0`, `on`, `off`, `yes` and `no` (trimmed, any case) and the numbers 1 and 0. Anything else, including `''`, is a cast error instead of `false`.
- Number: `''`, whitespace, hex and octal strings, `NaN` and infinite values (string or number input) are cast errors. Trimmed plain decimal and exponent notation still work.
- `notNull` no longer treats the strings `'null'`, `'Null'` and `'NULL'` as null. Pass `{ treatNullStringAsNull: true }` to restore the old behaviour.
- `email` accepts top-level domains up to 63 characters (was 9).
- `equality` fails when no `path` is configured and resolves dotted paths.
- A null-prototype object in a String field is a validation error instead of a `TypeError`.
- `ObjectPathAccessor.pathsMatch` now honours the escaped asterisk.
