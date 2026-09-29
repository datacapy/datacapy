#!/usr/bin/env bash
set -euo pipefail

# Publishes the @datacapy/* packages to npm.
#
# Run ./scripts/release.sh first when there are pending changesets: it bumps versions and
# tags. This script only publishes whatever versions are in the package.json files and not
# yet on the registry, in dependency order. pnpm rewrites `workspace:*` dependencies to the
# real version numbers in the published tarballs (plain `npm publish` would not).
#
# Usage:
#   ./scripts/publish.sh --dry-run   build, test, and show each tarball without publishing
#   ./scripts/publish.sh             the same, then confirm and publish for real
#
# npm asks for a one-time password when the account has 2FA enabled.

cd "$(dirname "$0")/.."

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--dry-run]" >&2
      exit 2
      ;;
  esac
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean. Commit or stash changes first." >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "master" ]]; then
  echo "Publish from master (currently on '$BRANCH')." >&2
  exit 1
fi

if ! NPM_USER=$(npm whoami 2>/dev/null); then
  echo "Not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi
echo "npm user: $NPM_USER"

echo
echo "Packages and registry status:"
TO_PUBLISH=0
for f in package/*/package.json; do
  name=$(node -p "require('./$f').name")
  version=$(node -p "require('./$f').version")
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "  ${name}@${version}  already published, will be skipped"
  else
    echo "  ${name}@${version}  to publish"
    TO_PUBLISH=$((TO_PUBLISH + 1))
  fi
done

if [[ "$TO_PUBLISH" -eq 0 ]]; then
  echo
  echo "Nothing to publish: every version is already on the registry." >&2
  exit 1
fi

echo
pnpm install --frozen-lockfile
pnpm build
pnpm test

echo
echo "Dry run of the tarballs (check that dist/ is present and tests are absent):"
pnpm -r publish --access public --dry-run --no-git-checks

if [[ "$DRY_RUN" == true ]]; then
  echo
  echo "Dry run complete. Nothing was published."
  exit 0
fi

echo
read -r -p "Publish ${TO_PUBLISH} package(s) to npm as ${NPM_USER}? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

pnpm -r publish --access public --no-git-checks

echo
echo "Published. Check https://www.npmjs.com/org/datacapy"
