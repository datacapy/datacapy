# Constructors and raw data

A DataCapy constructor is the hydration step. A query result, JSON file or API
payload is raw, plain data; the schema calls the constructor to turn it into an
instance:

```
raw data (plain objects)  ->  new X(raw)  ->  X instance (methods, defaults)
     input type                                  output type
```

The two shapes differ, so one type cannot describe both. For example
`{ label: { en: 'Yes' }, surveyId: null }` goes in, and an instance whose
`label` is an `L10n` class comes out.

`SchemaConstructor.from(SchemaX)` derives both from the schema, so a model needs
no hand-written `*Data` mirror type:

- **Output** is `InferSpec`.
- **Input** is `InferInputSpec`: every key optional and nullable (`null` counts
  as missing), a field typed with `as<Class>()` accepted in plain-data form or
  as the instance itself (methods dropped, recursively; see `Plain`).

```ts
class Summary extends SchemaConstructor.from(SchemaSummary) {}

new Summary({ label: { en: 'Yes' } })
```

With no options, the constructor copies every input key onto the instance
(unknown keys pass through), fills `undefined` and `null` keys from the schema's
defaults (so `''`, `0` and `false` are kept), and leaves an absent key absent.

See
[Filling defaults in a constructor](builder.md#filling-defaults-in-a-constructor)
for what each option does and when to use it.
