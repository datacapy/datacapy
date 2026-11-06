#!/usr/bin/env bash
set -euo pipefail

# Creates a GitHub release for every @datacapy/* package whose current version has a
# pushed tag but no GitHub release yet. Notes come from that version's CHANGELOG.md entry.
# Idempotent: versions that already have a release are skipped, so it is safe to re-run.
# ./scripts/publish.sh runs it after a real publish; run it by hand to catch up.
#
# Usage:
#   ./scripts/github-release.sh --dry-run   list what would be created
#   ./scripts/github-release.sh             create the releases

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

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install it and run 'gh auth login'." >&2
  exit 1
fi

# Prints the body of the "## <version>" section, up to the next "## " heading.
changelog_notes() {
  awk -v v="## $2" '
    $0 == v { found = 1; next }
    found && /^## / { exit }
    found { print }
  ' "$1"
}

CREATED=0
while IFS= read -r f; do
  dir=$(dirname "$f")
  name=$(node -p "require('./$f').name")
  version=$(node -p "require('./$f').version")
  tag="${name}@${version}"

  if gh release view "$tag" >/dev/null 2>&1; then
    echo "  $tag  release exists, skipped"
    continue
  fi
  if ! git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
    echo "  $tag  tag not on origin (run ./scripts/release.sh first), skipped" >&2
    continue
  fi

  notes=$(changelog_notes "$dir/CHANGELOG.md" "$version")
  if [[ -z "${notes//[[:space:]]/}" ]]; then
    echo "  $tag  no CHANGELOG.md entry for $version, skipped" >&2
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "  $tag  would create release"
  else
    # Older versions released late must not steal the Latest badge from a newer one.
    gh release create "$tag" --title "$tag" --verify-tag --latest=false --notes "$notes" >/dev/null
    echo "  $tag  release created"
  fi
  CREATED=$((CREATED + 1))
done < <(ls package/*/package.json)

echo
if [[ "$DRY_RUN" == true ]]; then
  echo "$CREATED release(s) would be created."
else
  echo "$CREATED release(s) created."
fi
