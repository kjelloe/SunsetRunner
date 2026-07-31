#!/bin/bash
# Full self-test: JS unit suite + Luau (lune) cross-language parity, with a
# summary line. Exit non-zero if either gate fails.
set -uo pipefail
cd "$(dirname "$0")"

echo "== JS suite (node --test) =="
npm test --silent
js_rc=$?

echo
echo "== Luau parity gates (lune) =="
if command -v lune >/dev/null 2>&1; then
  lune run luau/spine-check.luau \
    && lune run luau/checkpoint-1a-check.luau \
    && lune run luau/collision-1a-check.luau
  luau_rc=$?
else
  echo "lune not installed — skipping Luau parity gates"
  luau_rc=0
fi

echo
if [ "$js_rc" -eq 0 ] && [ "$luau_rc" -eq 0 ]; then
  echo "SELF-TEST OK (js=$js_rc luau=$luau_rc)"
  exit 0
fi
echo "SELF-TEST FAIL (js=$js_rc luau=$luau_rc)"
exit 1
