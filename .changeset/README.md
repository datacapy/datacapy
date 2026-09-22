# Changesets

This directory tracks pending version bumps via [Changesets](https://github.com/changesets/changesets).

We do not publish these packages to npm — `mzen-*` is consumed by `veysur` purely via the
pnpm `workspace:*` protocol. "Release" here means: bump each package's `package.json`
version, write its `CHANGELOG.md` entry, tag the repo, and cut a GitHub release. See the
root `AGENTS.md` "Releases" section for the full flow.

Read the [Changesets documentation](https://github.com/changesets/changesets/tree/main/docs) for more information.
