# 65 — Mobile render perf profile

Established in `marker-0088`. A repeatable, headless measurement of the client's
per-frame render cost on phone-class hardware, so renderer changes can be checked
for regression without a device in hand.

## Tool — `tools/mobile_perf.mjs` (`npm run perf:mobile`)

- Boots the real client (via `startServer`) in a 390×844 viewport at DPR 3, on
  the heaviest course (grand_tour, `?course=4`), muted, car/diff pre-picked so it
  drives straight into the race.
- Launches Chromium with `--disable-frame-rate-limit`/`--disable-gpu-vsync`, so
  `requestAnimationFrame` fires as fast as the main thread allows and each delta
  is the true per-frame CPU cost (predict + canvas render), not a vsync-capped
  16.7 ms.
- Throttles CPU via CDP `Emulation.setCPUThrottlingRate` at 1× / 4× / 6× (desktop
  / mid / low-end phone), warms up 5 s (past splash + countdown), samples 5 s,
  reports p50/p95/p99 ms, ~fps, and the fraction of frames over the 60 Hz / 30 Hz
  budgets.
- Standalone like `browser_smoke.mjs`; skips cleanly if Playwright is absent.
  NOT wired into `test.sh` (it is a measurement, not a pass/fail gate — numbers
  vary run to run).

## Finding

Mid-range (4×) holds a 60 fps median with minor micro-jank; low-end (6×) runs
~38 fps but keeps 90% of frames under the 30 fps floor — playable across the
range. The cost is Canvas 2D fill at DPR 3, not the engine (~0.04 ms/tick). Full
numbers and the cheapest low-end wins (cap DPR, shorten draw distance) live in
[`PERFORMANCE.md`](../PERFORMANCE.md).

## Not verified / deferred

SwiftShader headless is a relative instrument, not a real GPU/phone — absolute fps
still needs the `PLAYTEST.md` device pass. The DPR-cap / draw-distance
optimisations are logged, not built.
