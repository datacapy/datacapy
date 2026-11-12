# Releasing DataCapy

Each `@datacapy/*` package (`id`, `migrate`, `om`, `schema`, `server`) has its own semver line, tracked with [Changesets](https://github.com/changesets/changesets). Releases are manual and run from `master`.

## 1. Add a changeset with the change

```bash
pnpm changeset
```

Pick the affected packages, the bump level (patch, minor, major) and write the changelog summary. Commit the generated `.changeset/*.md` file with the code change.

**Below 1.0, a breaking change is a `minor` bump, never `major`.** Changesets turns a `major` on a 0.x package into 1.0.0, so going to 1.0 must be a decision, not a side effect of classifying a change. `release.sh` and `publish.sh` enforce this with `scripts/changeset-check-first-major.sh`. Once a package is at 1.0 or above, `major` works as normal.

### Going to 1.0 on purpose

Add the `major` changeset, then name the package when releasing and publishing:

```bash
./scripts/release.sh --allow-first-major=@datacapy/id
./scripts/publish.sh --allow-first-major=@datacapy/id
```

`release.sh` checks the changesets before versioning and the resulting versions afterwards (restoring the tree on failure). `publish.sh` also refuses any unpublished `1.0.0` that is not named, which catches versions bumped by hand.

## 2. Version, tag and push

```bash
./scripts/release.sh
```

This needs a clean working tree and at least one pending changeset. It runs `pnpm changeset version`, commits `chore(release): version packages`, pushes, then creates and pushes a `<package-name>@<version>` tag for each bumped package. The tags are the only GitHub record of a release; no GitHub release objects are created, so ignore the `gh release create` commands the script prints at the end.

## 3. Publish to npm

```bash
./scripts/publish.sh --dry-run
./scripts/publish.sh
```

The dry run builds, tests and lists each tarball without publishing; check that `dist/` is present and tests are absent. The real run repeats that, asks for confirmation, then publishes every version not yet on the registry, in dependency order. `pnpm` rewrites `workspace:*` dependencies to real versions in the tarballs.

Requirements:

- Be on `master` with a clean tree, and logged in with `npm login` (`npm whoami` must work).
- Set `NPM_TOKEN` or paste it when prompted. Use a granular access token with read/write on `@datacapy` and "Bypass two-factor authentication" ticked. The token goes into a throwaway `npmrc` that is deleted on exit; `~/.npmrc` is never touched.

## 4. Bump the pin in veysur

Consumers use the `workspace:*` protocol from this submodule. After a release, commit the new submodule pointer in `veysur`, then in `veysur-cloud`.
