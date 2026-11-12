---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Add the `ConstructCollection<Name>` tag. On an array property, or an array element of another array, the generator emits `.constructCollection('Name')`. On any other type it fails the run.
