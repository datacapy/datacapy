---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Add the `Required` and `OneOf` tags. `Required` keeps `required()` on a key that also has `Default` or `Init`, which otherwise replace it. `OneOf<'a' | 'b'>` restricts a plain `string` with `inArray<string>([...])`, for a model whose TypeScript type is deliberately wider than its allowed values.
