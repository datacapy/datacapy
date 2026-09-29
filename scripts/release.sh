#!/usr/bin/env bash
set -euo pipefail

# Cuts a release for whichever @datacapy/* package(s) have pending changesets.
# Each package versions independently, so this may bump more than one package
# at once, each getting its own <package-name>@<version> tag.
#
# Mechanical steps only: version bump, commit, tag, push. GitHub release
# creation is left as a manual step (printed at the end) since changelog
# entries don't extract cleanly enough to automate reliably.

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean. Commit or stash changes first." >&2
  exit 1
fi

if ! find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' | grep -q .; then
  echo "No pending changesets in .changeset/ - nothing to release." >&2
  exit 1
fi

pnpm changeset version

CHANGED_PACKAGE_JSON=$(git diff --name-only -- 'package/*/package.json')
if [[ -z "$CHANGED_PACKAGE_JSON" ]]; then
  echo "changeset version produced no package version bumps." >&2
  exit 1
fi

git add -A
git commit -m "chore(release): version packages"
git push

TAGS=()
CHANGELOGS=()
while IFS= read -r f; do
  name=$(node -p "require('./$f').name")
  version=$(node -p "require('./$f').version")
  tag="${name}@${version}"
  git tag "$tag"
  TAGS+=("$tag")
  CHANGELOGS+=("$(dirname "$f")/CHANGELOG.md")
done <<<"$CHANGED_PACKAGE_JSON"

git push --tags

echo
echo "Tagged and pushed:"
printf '  %s\n' "${TAGS[@]}"
echo
echo "Then publish to npm with ./scripts/publish.sh (run it with --dry-run first)."
echo
echo "Next: cut a GitHub release for each tag from its CHANGELOG.md entry, e.g.:"
for i in "${!TAGS[@]}"; do
  tag="${TAGS[$i]}"
  echo "  gh release create '$tag' --title '$tag' --notes-file <(sed -n '/^## ${tag##*@}\$/,/^## /p' ${CHANGELOGS[$i]} | sed '\$d')"
done
