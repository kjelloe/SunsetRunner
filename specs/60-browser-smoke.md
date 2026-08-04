# 60 — Browser smoke test (Playwright)

Established in `marker-0081`. The one seam automation couldn't reach before
(PLAYTEST §0 `[unverified]` / Pitfall #7): does the client actually boot and
render in a real browser? A headless-Chromium smoke now covers it.

## What it checks (`test/browser_smoke.mjs`)

Starts the real server (`startServer(0)` — static host + ws), launches headless
Chromium (Playwright), and for BOTH `local boot` and `?mode=remote`:
1. **no console errors / page exceptions** on boot (benign noise — favicon,
   AudioContext autoplay — is filtered),
2. **the canvas actually renders** (>3 distinct colours sampled from `#game`),
   which for remote also proves the **ws connect path** (no strand on join,
   Pitfall #7).

Standalone (NOT a `test/*.test.js` file) so the fast `npm test` stays browser-
free. `playwright` is a **devDependency**; the browser binary must be installed
(`npx playwright install chromium`).

## Running

- `npm run test:browser` — just the smoke.
- `./test.sh` — runs it after the JS + Luau gates when Playwright is resolvable;
  skips cleanly otherwise. `SKIP_BROWSER=1 ./test.sh` to skip (it adds ~15 s and
  launches Chromium). Summary line: `SELF-TEST OK (js=0 luau=0 browser=0)`.

## Verified

`./test.sh` → 269/269 JS + 4 Luau gates + browser smoke OK (local + remote both
render, no console errors).

## Not verified / deferred

Not a full E2E: it doesn't drive a whole race, assert pixels-are-a-road, or script
tab-backgrounding for the reconnect grace flow — those remain manual (PLAYTEST).
A future pass could add a scripted background/reconnect and a two-page multiplayer
check.
