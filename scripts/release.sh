#!/usr/bin/env bash
set -euo pipefail

# Cuts a release for whichever @datacapy/* package(s) have pending changesets.
# Each package versions independently, so this may bump more than one package
# at once, each getting its own <package-name>@<version> tag.
#
# Usage: ./scripts/release.sh [--allow-first-major=<package>[,<package>...]]
# A package below 1.0 may not reach 1.0 unless named in --allow-first-major (see
# ./scripts/changeset-check-first-major.sh).
#
# Mechanical steps only: version bump, commit, tag, push. npm publishing and
# GitHub release creation both happen in ./scripts/publish.sh afterwards.

cd "$(dirname "$0")/.."

ALLOW_FIRST_MAJOR=""
for arg in "$@"; do
  case "$arg" in
    --allow-first-major=*) ALLOW_FIRST_MAJOR="${arg#*=}" ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--allow-first-major=<package>[,<package>...]]" >&2
      exit 2
      ;;
  esac
done

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean. Commit or stash changes first." >&2
  exit 1
fi

if ! find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' | grep -q .; then
  echo "No pending changesets in .changeset/ - nothing to release." >&2
  exit 1
fi

./scripts/changeset-check-first-major.sh pre "$ALLOW_FIRST_MAJOR"

pnpm changeset version

./scripts/changeset-check-first-major.sh post "$ALLOW_FIRST_MAJOR"

CHANGED_PACKAGE_JSON=$(git diff --name-only -- 'package/*/package.json')
if [[ -z "$CHANGED_PACKAGE_JSON" ]]; then
  echo "changeset version produced no package version bumps." >&2
  exit 1
fi

git add -A
git commit -m "chore(release): version packages"
git push

TAGS=()
while IFS= read -r f; do
  name=$(node -p "require('./$f').name")
  version=$(node -p "require('./$f').version")
  tag="${name}@${version}"
  git tag "$tag"
  TAGS+=("$tag")
done <<<"$CHANGED_PACKAGE_JSON"

git push --tags

echo
echo "Tagged and pushed:"
printf '  %s\n' "${TAGS[@]}"
echo
echo "Next: ./scripts/publish.sh --dry-run, then ./scripts/publish.sh."
echo "It publishes to npm and then creates the GitHub releases."
