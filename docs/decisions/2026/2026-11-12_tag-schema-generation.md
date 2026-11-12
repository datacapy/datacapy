# Tag schema generation: TypeScript interfaces are the source of truth

**Status:** accepted
**Decided:** 2026-11-12
**Scope:** package/schema, package/codegen

## Context

- A schema and its type were written twice, or the type was inferred from a schema that is hard to read at a glance.
- Large consumers want the type to be the artefact people read and review.
- The generator must run in lint-staged and CI, so its output has to be stable and formatted.

## Decision

Describe rules with type-only tags on a TypeScript interface, and generate the checked-in `sb.schema(...)` module with `datacapy-gen`; each generated file ends with a compile-time check that the schema infers exactly the interface.

## Key reasons

- Tags are phantom optional properties, so plain data stays assignable and nothing reaches the bundle.
- The exactness check (`AssertSchema`) also lets a hand-written schema adopt the interface first.
- Generated files are checked in, so the runtime has no new dependency and diffs show what changed.
- `datacapy-gen --check` and `--staged` keep the files from drifting.

## Choices inside the decision

- **TypeScript compiler API, not ts-morph.** No new dependency; `typescript` is a peer, so the consumer's compiler reads its own code.
- **`strictNullChecks` is always on** for the generator's program, because consumers that build with it off would lose `T | null`.
- **Output is formatted with the consumer's Prettier** (child process), so a formatting hook never makes `--check` report stale files.
- **A non-optional key with only `Init` gets no `required()`.** `Init` already supplies the value on insert.
- **References use `sb.refTo<SpecFor<X>>((): unknown => SchemaX)`.** The stated type and the `unknown` return annotation avoid "referenced in its own base expression" in cycles.
- **Chain order is fixed**, since intersection order in the checker is unreliable.

## Rejected alternatives

| Alternative | Rejected because                                       |
| ----------- | ------------------------------------------------------ |
| ts-morph    | New dependency for a job the compiler API already does |

## Revisit when

- Numeric literal unions, tuples, `Map` or `Date` ranges are needed (see [type mapping](../../../package/codegen/docs/type-mapping.md#not-supported-yet)).

## Related

- [Type tags](../../../package/schema/docs/tags.md)
- [Codegen guide](../../../package/codegen/docs/guide.md), [type mapping](../../../package/codegen/docs/type-mapping.md), [architecture](../../../package/codegen/docs/architecture.md)
