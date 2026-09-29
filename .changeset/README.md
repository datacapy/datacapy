# Changesets

This directory tracks pending version bumps via [Changesets](https://github.com/changesets/changesets).

These packages are published to npm under the `@datacapy` scope and consumed by `veysur` via the
pnpm `workspace:*` protocol. "Release" here means: bump each package's `package.json`
version, write its `CHANGELOG.md` entry, tag the repo, cut a GitHub release, and publish
with `./scripts/publish.sh`. See the
root `AGENTS.md` "Releases" section for the full flow.

Read the [Changesets documentation](https://github.com/changesets/changesets/tree/main/docs) for more information.
