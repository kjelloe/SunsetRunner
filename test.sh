#!/bin/bash
# Full self-test: JS unit suite + Luau (lune) cross-language parity + an optional
# headless-browser smoke, with a summary line. Exit non-zero if a gate fails.
# Set SKIP_BROWSER=1 to skip the browser smoke (adds ~15 s; launches Chromium).
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
    && lune run luau/collision-1a-check.luau \
    && lune run luau/fork-1a-check.luau
  luau_rc=$?
else
  echo "lune not installed — skipping Luau parity gates"
  luau_rc=0
fi

echo
echo "== Browser smoke (Playwright) =="
browser_rc=0
if [ "${SKIP_BROWSER:-0}" = "1" ]; then
  echo "SKIP_BROWSER=1 — skipping browser smoke"
elif node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  node test/browser_smoke.mjs
  browser_rc=$?
else
  echo "playwright not installed — skipping browser smoke"
fi

echo
if [ "$js_rc" -eq 0 ] && [ "$luau_rc" -eq 0 ] && [ "$browser_rc" -eq 0 ]; then
  echo "SELF-TEST OK (js=$js_rc luau=$luau_rc browser=$browser_rc)"
  exit 0
fi
echo "SELF-TEST FAIL (js=$js_rc luau=$luau_rc browser=$browser_rc)"
exit 1
