<!-- cspell:ignore Handoff endpointConfig aclContext apiConfigs -->

# Handoff: `enable: false` does not disable endpoints or services

## How this was found

While debugging an intermittent `403` on a new `PUT /project/:projectId` route
in `veysur-api` (`package/api/src/endpoint/shared/project.ts`), the cause turned
out to be a route collision: an older endpoint, `putProject`, was declared with
`enable: false` on the individual endpoint config expecting that to disable it,
but it was still live and registered on the same path pattern, silently
swallowing every request before the new route could ever be reached. Tracing why
led to `mzen-server`'s registration code, where two separate `enable` bugs were
found: one on individual endpoints, one on whole services. Both are documented
here since they share a root cause (nothing in this package ever actually
implements "endpoint/service is off"), and whoever picks this up will be
touching the same function for both.

## Bug 1: per-endpoint `enable` does not exist at all

`ServerApiConfigEndpoint` (`src/api-config.ts:41-68`) has no `enable` field:

```ts
export interface ServerApiConfigEndpoint {
  path?: string
  groups?: Array<'default' | 'read' | 'write' | string>
  method?: string
  verbs?: Array<'get' | 'put' | 'post' | 'delete' | string>
  object?: any
  repo?: string
  service?: string
  bodyParser?: { ... }
  data?: { [key: string]: ServerApiConfigEndpointData }
  acl?: ServerApiConfigAcl
  priority?: number
  skipResponse?: boolean
  response?: { ... }
}
```

Nothing in `EndpointRegistrar.registerEndpointsConfig`
(`src/server/endpoint-registrar.ts:59-129`) or
`ServerRemoteObject.getMiddlewareConfig` (`src/remote-object.ts:129-190`) ever
reads `endpointConfig.enable`. Grepping both files (and every file under `src/`)
for `endpointConfig.enable` or `config.enable` inside the per-endpoint loop
returns nothing: the only mechanism that actually removes an individual
endpoint before registration is the service-level
`disable: { endpointName: true }` map, applied in `registerEndpointsConfig`
(`endpoint-registrar.ts:85-98`):

```ts
for (const endpointName in endpoints) {
  const groups = endpoints[endpointName].groups
  if (Array.isArray(groups)) {
    groups.forEach(function (group) {
      if (endpoints[endpointName] && endpointDisableGroup[group] == true) {
        delete endpoints[endpointName]
      }
    })
  }
  if (endpoints[endpointName] && endpointsDisable[endpointName] == true) {
    delete endpoints[endpointName]
  }
}
```

Because `endpoints: { [key: string]: ServerApiConfigEndpoint }` on
`ServerApiConfig` has no excess-property protection at the object-literal call
site in consuming code (the config objects are typically declared untyped, e.g.
`export const projectConfig = { ... }`, so TypeScript never
excess-property-checks them against `ServerApiConfig`), writing `enable: false`
inside an endpoint silently compiles and silently does nothing at runtime. There
is no type error, no lint warning, no log line: the endpoint just stays live.

**Live impact**: `package/api/src/endpoint/shared/project.ts`'s `putProject`
endpoint (`PUT /project/:_id`, `role: 'authedAdmin'`: any authenticated account
user, not project-owner-checked) accepts an unvalidated `data` blob in the
request body and updates arbitrary fields (including `ownerId`, `status`,
`subdomain`) on **any** project by `_id`, no ownership check. It was written
with `enable: false` specifically to keep it off pending a safer replacement,
and has been live in production regardless since it was added. `veysur-api` has
since been patched to route around this using the service-level `disable` map
instead (which _does_ work; see Bug 2's caveat below), but the underlying gap
in `mzen-server` remains and will bite the next person who writes
`enable: false` on an endpoint, matching the `bodyParser.json.enable` /
`bodyParser.urlencoded.enable` naming already used elsewhere in this same
interface (`api-config.ts:50-58`), a strong signal this is the naming a caller
would reach for by habit.

## Bug 2: service-level `enable: false` also doesn't stop registration

`registerEndpointsConfig` (`src/server/endpoint-registrar.ts:59-83`):

```ts
const enable = config.enable ? config.enable : {}
const aclConfig = config.acl ? config.acl : {}
const endpointsDisable = config.disable ? config.disable : {}
const endpointDisableGroup = config.disableGroup ? config.disableGroup : {}
const endpoints = config.endpoints ? config.endpoints : {}

if (!enable) return
```

When `config.enable` is `false` (or `undefined`), the ternary's else-branch
returns `{}`, and `{}` is truthy in JavaScript. `if (!enable) return` is
therefore **never true** regardless of what `config.enable` was actually set to:
`!true === false` (registration proceeds, correctly) and `!{} === false`
(registration also proceeds, incorrectly). There is no input that makes this
guard fire. The existing test (`src/server/endpoint-registrar.test.ts:117-133`,
`'skips configs with no enable flag'`) does not catch this because it only
asserts `mockApiConfigRegistry.getApiConfigs` was called, never checking whether
registration actually happened or was skipped: see "Tests to add" below.

**Live impact**: `package/api/src/endpoint/platform/project-cache.ts` declares
`enable: false` at the service level, intending to keep its four
cache-management endpoints (`clearProjectCache`, `invalidateSubdomain`,
`invalidateDataSource`, `getStats`) off. They are routable today regardless.
Exposure is narrower than Bug 1's example: each endpoint has its own
`role: 'platformAdmin'` ACL rule requiring a real platform-admin JWT with 2FA
enabled (`src/acl/role-assessor/PlatformAdmin.ts`), but the intended
kill-switch does not work, and whoever declared `enable: false` here was relying
on it doing what it says.

## Suggested fix

### 1. Type (`src/api-config.ts`)

Add `enable?: boolean` to `ServerApiConfigEndpoint`, next to `priority`/
`skipResponse`, same shape as the top-level `ServerApiConfig.enable`.

### 2. Registration logic (`src/server/endpoint-registrar.ts`)

- Fix the service-level guard to a direct boolean check instead of the
  truthy-`{}` fallback:
  ```ts
  if (config.enable === false) return
  ```
  (default is enabled when `enable` is omitted or `true`, matching current
  documented/intended behaviour and every existing config in `veysur-api` that
  doesn't set it at all.)
- Extend the endpoint-removal loop (the same one that currently handles
  `disable`/`disableGroup`) to also drop any endpoint whose own config sets
  `enable: false`:
  ```ts
  if (endpoints[endpointName]?.enable === false) {
    delete endpoints[endpointName]
  }
  ```
  Place this alongside the existing `endpointsDisable[endpointName] == true`
  check so `endpoint.enable = false` and being listed in the service's `disable`
  map are equivalent, and both are resolved before the
  `Object.keys(endpoints).length == 0` early-return a few lines below, so an
  all-disabled service still no-ops cleanly with zero routes registered.

### 3. Tests (`src/server/endpoint-registrar.test.ts`)

The existing tests in this file are uniformly weak: every assertion checks that
a mock function was _called_, never what was actually registered or skipped,
which is how both bugs above shipped unnoticed. `initRouter` is mocked away
entirely (`jest.mock('../remote-object')`), so there's currently no way to see
what middleware config was built. Recommend either:

- Capturing the arguments passed to the mocked `ServerRemoteObject` constructor
  / `setAcl` / `initRouter` and asserting on the endpoint set that survived, or
- Un-mocking `ServerRemoteObject` for a narrower set of registration-focused
  tests and asserting against the real `router.stack` (Express exposes
  registered routes there), which would also catch route-collision bugs like the
  one that led here.

At minimum, add:

- service `enable: false` → zero routes/endpoints registered (currently passes
  for the wrong reason: nothing asserts this)
- service `enable: true` / omitted → routes registered (regression guard)
- an individual endpoint with `enable: false` inside `endpoints` → dropped from
  the set that reaches `ServerRemoteObject`, same assertion style as the
  existing `'removes disabled endpoints'` /
  `'removes endpoints in disabled groups'` tests just below it
  (`endpoint-registrar.test.ts:241-293`): these two are the closest existing
  precedent for what a real assertion should check here.

### 4. Version bump

Patch bump `package.json` (currently `0.1.209`) once merged, and update the
version reference in `package/api/AGENTS.md` (`**Version**: 0.1.209` under
"mzen-server (REST API Server)") to match: that file is manually maintained,
not generated.

## Downstream cleanup in `veysur-api` (after this lands)

Neither of the two live-impact call sites _need_ code changes: both remain
correct once this bug is fixed:

- `package/api/src/endpoint/shared/project.ts`: `putProject` now uses the
  working `disable: { putProject: true }` map (already patched, unrelated to
  this handoff) rather than the broken inline `enable: false`. No change
  required; either mechanism will work correctly after this fix, so leaving it
  on `disable` is fine.
- `package/api/src/endpoint/platform/project-cache.ts`: once `mzen-server` is
  rebuilt and `veysur-api` picks up the new version, this service's
  `enable: false` will actually take effect for the first time and its four
  endpoints will start returning 404 instead of being routable. **Flag this to
  whoever owns that file before merging**: confirm the service was in fact
  meant to stay off (it reads like an in-progress feature), since this fix will
  change its live behaviour the moment the dependency is bumped, not just
  silence a lint warning.

## Verification

1. `cd package/mzen-server && pnpm test && pnpm typecheck`
2. New/adjusted tests from "Tests to add" fail against the current code and pass
   after the fix. Don't just add passing tests; confirm they'd have caught both
   bugs.
3. Bump the workspace dependency in `veysur-api` (`workspace:*` already resolves
   to the local build, so just rebuild `mzen-server` and restart the API), then
   hit `POST /platform/project-cache/stats` (or any of its siblings) as a
   `platformAdmin`: should now 404.
4. Re-run `package/api`'s `project` endpoint/service test suites
   (`pnpm --filter veysur-api test -- src/model/service/ServiceProject src/endpoint/shared/project`)
   to confirm the rename-endpoint fix from the original investigation still
   passes with the dependency bump in place.
