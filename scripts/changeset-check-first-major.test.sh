#!/usr/bin/env bash
set -uo pipefail

# Tests changeset-check-first-major.sh against a throwaway git repo. Run: ./scripts/changeset-check-first-major.test.sh

SCRIPT="$(cd "$(dirname "$0")" && pwd)/changeset-check-first-major.sh"
FAILURES=0

setup() {
  WORK=$(mktemp -d)
  cd "$WORK"
  git init -q
  git config user.email t@example.com
  git config user.name t
  mkdir -p .changeset package/a package/b
  echo '{"name":"@datacapy/a","version":"0.1.5"}' >package/a/package.json
  echo '{"name":"@datacapy/b","version":"2.0.0"}' >package/b/package.json
  git add -A
  git commit -q -m init
}

changeset() { printf -- "---\n'%s': %s\n---\n\nChange.\n" "$1" "$2" >".changeset/$3.md"; }

expect() {
  local want="$1" label="$2"
  shift 2
  "$@" >/dev/null 2>&1
  local got=$?
  if { [[ "$want" == pass && $got -eq 0 ]] || [[ "$want" == fail && $got -ne 0 ]]; }; then
    echo "ok   $label"
  else
    echo "FAIL $label (exit $got)"
    FAILURES=$((FAILURES + 1))
  fi
}

setup
changeset @datacapy/a minor one
expect pass "pre: minor on 0.x" "$SCRIPT" pre ""
changeset @datacapy/a major two
expect fail "pre: major on 0.x" "$SCRIPT" pre ""
expect pass "pre: major on 0.x with allow" "$SCRIPT" pre "@datacapy/a"
rm .changeset/two.md
changeset @datacapy/b major three
expect pass "pre: major on 1.0+" "$SCRIPT" pre ""

setup
echo '{"name":"@datacapy/a","version":"1.0.0"}' >package/a/package.json
expect fail "post: 0.x to 1.0" "$SCRIPT" post ""
if [[ "$(grep -c '0.1.5' package/a/package.json)" == 1 ]]; then echo "ok   post: tree restored"; else echo "FAIL post: tree restored"; FAILURES=$((FAILURES + 1)); fi
echo '{"name":"@datacapy/a","version":"1.0.0"}' >package/a/package.json
expect pass "post: 0.x to 1.0 with allow" "$SCRIPT" post "@datacapy/a"
git checkout -q -- .
echo '{"name":"@datacapy/a","version":"0.2.0"}' >package/a/package.json
expect pass "post: 0.x to 0.2" "$SCRIPT" post ""

expect fail "publish: unpublished 1.0.0" "$SCRIPT" publish "" "@datacapy/a@1.0.0"
expect pass "publish: 1.0.0 with allow" "$SCRIPT" publish "@datacapy/a" "@datacapy/a@1.0.0"
expect pass "publish: 0.2.0" "$SCRIPT" publish "" "@datacapy/a@0.2.0"

exit $((FAILURES > 0))
