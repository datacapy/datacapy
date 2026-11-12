#!/usr/bin/env bash
set -euo pipefail

# Guards against a package leaving 0.x by accident. Changesets turns a `major` changeset on a
# 0.x package into 1.0.0, so going to 1.0 must be chosen, not a side effect of classifying a
# breaking change. See docs/releasing.md.
#
# Usage (run from the repo root):
#   changeset-check-first-major.sh pre     <allow-list>                 changesets vs current versions
#   changeset-check-first-major.sh post    <allow-list>                 versions after `changeset version` vs HEAD
#   changeset-check-first-major.sh publish <allow-list> <name@version>...  versions about to reach npm
#
# cspell:ignore gsub
# <allow-list> is a comma-separated list of package names (may be empty) that may go to 1.0.

MODE="${1:-}"
ALLOW="${2:-}"
shift 2 || true

is_allowed() {
  [[ ",${ALLOW}," == *",$1,"* ]]
}

fail() {
  echo "$1" >&2
  echo "Going to 1.0 must be chosen: pass --allow-first-major=<package>[,<package>...] if you mean it." >&2
  exit 1
}

case "$MODE" in
  pre)
    for f in .changeset/*.md; do
      [[ "$(basename "$f")" == "README.md" ]] && continue
      [[ -e "$f" ]] || continue
      while IFS= read -r name; do
        pkg_json=$(grep -lE "\"name\": ?\"${name}\"" package/*/package.json | head -n1 || true)
        [[ -n "$pkg_json" ]] || continue
        version=$(node -p "require('./${pkg_json}').version")
        if [[ "${version%%.*}" == "0" ]] && ! is_allowed "$name"; then
          fail "${f} sets a major bump for ${name}, which is at ${version}. Below 1.0 a breaking change is a minor bump."
        fi
      done < <(awk '/^---$/ {n++; next} n==1 && /: *major *$/ {gsub(/[\x27" ]/, "", $1); sub(/:.*/, "", $1); print $1}' "$f")
    done
    ;;
  post)
    for f in $(git diff --name-only -- 'package/*/package.json'); do
      name=$(node -p "require('./$f').name")
      new=$(node -p "require('./$f').version")
      old=$(git show "HEAD:$f" | node -p "JSON.parse(require('fs').readFileSync(0, 'utf8')).version")
      if [[ "${old%%.*}" == "0" && "${new%%.*}" != "0" ]] && ! is_allowed "$name"; then
        git checkout -- .
        fail "Versioning would take ${name} from ${old} to ${new}. Working tree restored."
      fi
    done
    ;;
  publish)
    for spec in "$@"; do
      name="${spec%@*}"
      version="${spec##*@}"
      if [[ "$version" == "1.0.0" ]] && ! is_allowed "$name"; then
        fail "${name}@1.0.0 would be its first 1.0 release."
      fi
    done
    ;;
  *)
    echo "Usage: $0 pre|post|publish <allow-list> [name@version...]" >&2
    exit 2
    ;;
esac
