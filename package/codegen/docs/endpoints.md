# Endpoint configs from tagged service classes

`datacapy-gen` can also write the `ServerApiConfig` for a service from the service itself. The class and its method
signatures are the only hand-edited input; the `X.endpoints.ts` beside the class is generated and checked in.

## Configure

Add an `endpoints` section to `datacapy.config.json`. Without it the endpoint generator does nothing.

| Option         | Default             | Meaning                                                 |
| -------------- | ------------------- | ------------------------------------------------------- |
| `include`      | top-level `include` | Globs of service files to scan                          |
| `marker`       | `endpoints`         | JSDoc tag that marks a service class                    |
| `outDir`       | beside each source  | Write generated files here, mirroring the source layout |
| `requireAcl`   | `true`              | Fail a `@route` that has no `@acl`                      |
| `serverModule` | `@datacapy/server`  | Module that exports the `ServerApiConfig` type          |

## Write the service

A service method takes one destructured params object, as the framework calls it. Tag each property with where it is
read from ([tags](../../server/docs/endpoint-tags.md)); an optional property is `required: false`.

```ts
import type { tagsEndpoint as e } from '@datacapy/server'

/** @endpoints surveyParticipantAttribute path=/platform/survey-participant-attribute */
export class ServiceSurveyParticipantAttribute extends Service {
  /**
   * @route patch /:surveyId
   * @acl projectAdmin
   * @error PlanLimitExceededError 402
   */
  async batchSave(args: {
    surveyId: string & e.Param
    projectId: string & e.Header<'X-Project-Id'>
    changes: AttributeBatchChange[] & e.Body
    orderedAttributeNames?: string[] & e.Body
    aclContext?: e.AclContext
  }): Promise<boolean> {}
}
```

### Class marker

`@endpoints <serviceName> [path=/prefix]`. A bare `path=` sets an empty prefix, for a service whose routes spell out their own full path (one service mounted under several prefixes). The service name is passed to `super({ name })` at runtime and is not
readable statically, so the marker states it. Without `path` the server derives `/<kebab-service-name>`.

### Method tags

| Tag                          | Meaning                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `@route <verbs> [path]`      | Required. Verbs are comma separated (`get,head`). No path means the server's default     |
| `@acl <role>[,<role>]`       | One allow rule per role. `public` is role `all`. `allow=false` makes the rules denies    |
| `@enable false`              | Emits `enable: false`                                                                    |
| `@error <ErrorClass> <code>` | Repeatable. For errors outside the server's defaults (`ServerError*` are already mapped) |

Every service starts with a deny-all rule, so an endpoint is reachable only through its own `@acl`. Tags may share a
line or sit on separate lines.

## Mapping

| Property type                          | `data.type` |
| -------------------------------------- | ----------- |
| `string`, string literals              | `String`    |
| `number`, number literals              | `Number`    |
| `boolean`                              | `Boolean`   |
| any array                              | `Array`     |
| objects, interfaces, `Date`, `unknown` | omitted     |

A union of different kinds (`string | number`) is an error. `Default<V>` becomes `defaultValue`. `AclContext` and
`AclConditions` properties emit nothing: the framework sets them after parsing.

## Checks

`datacapy-gen --report` lists every problem; `generate` throws them all together.

- a property whose type resolves to `any` (a bad import, or an explicit `any`): the tags on it would be lost, so it is an error
- a `:name` in the path with no `Param` property, or a `Param` property the path lacks
- a duplicate route (same verb and path)
- route shadowing: `/:id` registered before a literal sibling such as `/list` with the same verb
- a `@route` with no `@acl`, an `@acl` with no role, a bad verb, a non-public method
- an unknown tag, a property with two source tags, an unmappable type
- a params argument that is not a typed object

The generated file ends `} satisfies ServerApiConfig`, so it stops compiling if the server's config type changes.

## CLI

`datacapy-gen`, `--check`, `--report` and `--staged` run the schema and endpoint generators together. `--staged`
triggers on files containing `@schema` or the endpoint marker. A hand-written config can spread a generated one to
override one endpoint.
