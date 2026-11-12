---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Add the `Required` and `OneOf` tags. `Required` keeps `required()` on a key that also has `Default` or `Init`, which otherwise replace it. `OneOf<'a' | 'b'>` restricts a plain `string` with `inArray<string>([...])`, for a model whose TypeScript type is deliberately wider than its allowed values. `Default<EmptyObject>` now defaults a field to an empty object. `unknown & Relation` (any tag on `unknown`) generates `sb.mixed()` with the tag. `AssertSchema` and `AssertSpec` accept a tagged literal union such as `('a' | 'b') & Default<'a'>`, which cannot be stripped to the plain union, by checking that the two types are assignable to each other.
