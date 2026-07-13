<!-- cspell:ignore Handoff Repro indexless -->

# Handoff: `initDynamicReposForDataSource` never wires `repo.dataSource`

## How this was found

Unrelated to this bug: `pnpm test` in `package/mzen-om` was crashing on
`src/data-source-manager.test.ts` with
`TypeError: (0 , _jestUtil.isError) is not a function`, masking every test's
real result. That crash was caused by a workspace-level `pnpm.overrides` bug
(root `package.json`: `jest-util`/`jest-mock` pinned to open ranges `>=30.0.0`,
which let pnpm hoist a `jest-util` version that didn't match what
`jest-message-util@30.4.1`/`jest-mock@30.4.1` require — jest's internal packages
must stay in lockstep). That's already fixed (root repo commit `1b4ceeee`,
"fix(deps): pin jest-util/jest-mock overrides to exact matching version").
Fixing it unmasked a real, pre-existing failure in the same test file — this doc
is about that failure.

## The failing test

`src/data-source-manager.test.ts:45-63`,
`'releases the reference acquired for each dynamic repo after initDynamicReposForDataSource'`:

```
expect(received).toBeDefined()
Received: undefined

  59 |     // Every repo should have been wired to the resolved datasource.
  60 |     Object.values(repos).forEach((repo) => {
> 61 |       expect(repo.dataSource).toBeDefined()
```

Repro: `cd package/mzen-om && npx jest --testPathPatterns data-source-manager`

The test builds 18 repos with `dataSource: 'project'`, `autoIndex: false`, no
`indexes` configured, then calls
`manager.initDynamicReposForDataSource(dsName, context, repos)` and expects
every repo's `.dataSource` property to be set afterward. It isn't —
`repo.dataSource` stays `undefined` for all 18.

## Root cause

`DataSourceManager.initDynamicReposForDataSource`
(`src/data-source-manager.ts:257-277`) just loops:

```ts
for (const repo of repoList) {
  await this.initDynamicRepo(repo.getName(), context, repos)
}
```

`initDynamicRepo` (`src/data-source-manager.ts:233-248`) calls
`await repo.init(context)` and logs — it never calls `getDataSource` and never
assigns `repo.dataSource`.

`Repo.init()` (`src/repo/repo.ts:119-130`):

```ts
async init(context?): Promise<void> {
  if (!this.initialised) {
    var promises: Promise<any>[] = []
    if (!this.schema) {
      this.initSchema()
      if (this.config.autoIndex && this.hasIndexes())
        promises.push(this.createIndexes(context))
    }
    await Promise.all(promises)
    this.initialised = true
  }
}
```

The _only_ path that touches `getDataSource` (and therefore resolves/wires a
datasource onto the repo) is `createIndexes → createIndex → getDataSource`
(`repo.ts:432`), gated behind `this.config.autoIndex && this.hasIndexes()`.
Repos without indexes — or with `autoIndex: false`, as in this test — never call
`getDataSource` during `init()`, so `repo.dataSource` is never assigned.

Grepping `repo.ts`, `data-source-manager.ts`, and `model-manager.ts` for
`this.dataSource =` finds **zero** assignments anywhere in the class.
`Repo#dataSource` (`repo.ts:54`) is read in several places (`getDataSource()` at
`repo.ts:298,302`) but there is no code path, dynamic or static, that ever sets
it from `init()` or from `initDynamicReposForDataSource`. Every CRUD method
(`find`, `updateOne`, etc.) instead calls `this.getDataSource(context)` fresh
per-call, which resolves the datasource on demand and doesn't persist it back
onto `this.dataSource` for dynamic repos — that field is only ever pre-set
manually in tests (e.g. `repo.dataSource = new MockDataSource(...)`) or,
presumably, by whatever static-datasource wiring path exists elsewhere (not part
of the dynamic-resolution flow at all).

**Open question for whoever picks this up**: is `initDynamicReposForDataSource`
supposed to eagerly resolve and cache `repo.dataSource` for every repo up front
(in which case it's missing a
`repo.dataSource = await repo.getDataSource(context)`-style assignment, or an
equivalent that plays nicely with `releaseDataSource`'s refcounting), or is the
test's expectation wrong and `init()` was only ever meant to create indexes (in
which case the test assertion at line 61 should be removed/changed, and the
method possibly renamed since "init...ForDataSource" implies more than index
creation)? The second test in the same file
(`'still releases the reference if one repo throws during init'`, lines 65-85)
only asserts on refCount, not on `repo.dataSource`, which is a hint the wiring
assertion in the first test may have been aspirational/added ahead of the
implementation rather than a spec the code once satisfied and regressed from —
check `git log -p` / `git blame` on both the test and
`initDynamicReposForDataSource` to see which came first and whether there's a
related PR/commit message explaining intent.

## Masking side-effect to be aware of

Because `repo.dataSource` is never set, `getDataSource`/`releaseDataSource`
(which acquire/release a registry ref-count) are also never called for indexless
repos. The refCount assertion in the _first_ test (`entry?.refCount === 1`)
passes today, but for the wrong reason — nothing acquires or releases for those
18 repos, so the pre-seeded refCount of 1 is simply untouched, not correctly
balanced by 18 real acquire/release pairs. Fixing the wiring bug will very
likely start exercising the registry acquire/release path for these repos and
may change what that assertion needs to check (e.g. does resolving 18 repos
against one registry entry legitimately bump refCount past 1 before releasing
back down to 1, or should it never exceed 1 because they share one cached
resolution?). Re-verify this assertion's correctness once the actual wiring is
fixed, don't just make it pass.

## Suggested first step

Read `DataSourceManager` and `ModelManager` (`src/model-manager.ts`) in full to
find the intended static-vs-dynamic datasource resolution contract —
`getDataSource()`'s dynamic branch (`repo.ts:277-321`) references
`this.modelManager.getDataSourceDynamic(...)`, which is the piece that actually
resolves a dynamic datasource per-call. Determine whether
`initDynamicReposForDataSource` is meant to be a _warm-up/eager-cache_ step
(pre-resolving before first use) or whether the test's expectation is simply out
of date, before writing a fix.
