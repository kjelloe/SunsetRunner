# 49 — Splash screen + client loading bar

Established in `marker-0052`. A **SUNSET RUNNER** splash over a sunsetting beach
with palms shows while client-side assets load, with a LOADING bar filling below.
Client-only, no engine change.

## Splash (`client/splash.js`)

`drawSplash(g, view, progress)` paints a sunset sky gradient, sun, sea, sand, two
palm silhouettes, the big title, and a loading bar filled to `progress` (0–1,
clamped) with a `LOADING NN%` label. Fake-ctx-safe.

## Boot wiring (`client/main.js`)

Each asset `fetch` bumps a counter (`grab` via `.finally`). A splash rAF loop runs
until **both** all six assets are in **and** at least `MIN_SPLASH_MS` (1400 ms)
has elapsed — so the splash doesn't just flash on a fast local load — then boot
proceeds to the car-select / race. The bar animates over the minimum window.

## Verified

`test/splash.test.js`: title + LOADING drawn, percent reflects progress and
clamps (−1→0%, 5→100%), and the bar fill widens with progress. `./test.sh` →
212/212 + 4 Luau gates.

## Not verified / deferred

The scene's look needs eyes (§17). Palms are drawn primitives, not sprite art —
a nicer illustrated splash is a later asset task. A real progress signal (bytes
loaded) isn't available for tiny JSON; the count-based bar is sufficient here.
