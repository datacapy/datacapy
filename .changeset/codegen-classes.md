---
'@datacapy/codegen': minor
'@datacapy/schema': minor
---

Generate a schema from a class. `/** @schema name */` on a class reads its data fields (methods, accessors, statics and private members are left out, inherited fields are included) and constructs by the class name. `@datacapy/schema` adds `SchemaConstructor<T>`, an optional base that copies the constructor data onto the instance.
