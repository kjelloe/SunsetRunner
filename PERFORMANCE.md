# Performance profile

Sunset Runner separates cleanly into two costs: the **engine** (integer sim,
20 Hz, server-authoritative and mirrored in Luau) and the **renderer** (float
Canvas 2D on the client, 60 Hz). They are profiled independently.

## Engine (sim)

Measured earlier during the traffic-density work: at course-4 scale (6 seats,
94–375 traffic cars) the reducer runs **~0.037 ms/tick** and `hashSnapshot`
**~0.041 ms/tick**, against a 50 ms tick budget — roughly **1000× headroom**.
The engine is not a bottleneck on any target, including Roblox. Only rendering is
a device-class concern.

## Renderer (mobile) — `npm run perf:mobile`

`tools/mobile_perf.mjs` boots the real client in a phone-sized retina viewport
(390×844 @ DPR 3) against the actual server, drives the **heaviest** course
(grand_tour, `?course=4`), and measures the interval between `requestAnimationFrame`
callbacks with the browser's frame-rate limiter **off** — so each delta is the
real per-frame main-thread cost (client prediction + canvas render), not a
vsync-capped 16.7 ms. CPU is throttled via Chromium CDP to stand in for phones:
`4×` ≈ a mid-range device, `6×` ≈ a low-end one.

Representative run (headless Chromium; numbers vary ±15% run to run) **with the
DPR≤2 cap applied** (marker-0092 — `computeBufferSize` clamps effective DPR, so a
DPR-3 phone renders a 780-wide backing store, not 1170):

| CPU throttle | ~device        | p50 ms | p95 ms | p99 ms | ~fps | frames >16.7 ms | >33.3 ms |
|--------------|----------------|--------|--------|--------|------|-----------------|----------|
| 1×           | desktop        | 2.2    | 3.0    | 7.4    | 454  | 0%              | 0%       |
| 4×           | mid-range phone| 10.0   | 15.5   | 28.6   | 100  | 3%              | 0%       |
| 6×           | low-end phone  | 15.6   | 33.6   | 36.9   | 64   | 30%             | 6%       |

For reference, the same harness **before** the DPR cap (marker-0088) measured
4× at 16.0 ms p50 / 62 fps / 39% over budget and 6× at 26.2 ms / 38 fps / 100%
over budget. Capping the effective DPR moved the mid tier from occasional jank to
a near-solid 100 fps and roughly halved the low-end frame time.

### Reading it

- **Mid-range (4×): ~100 fps median, only 3% of frames over 16.7 ms.** Effectively
  smooth; no frame breaches the 30 fps floor.
- **Low-end (6×): ~64 fps median.** Now holds 60 most of the time; ~30% of frames
  tick just over 16.7 ms and 6% over 33 ms — occasional micro-jank, playable.
- **The cost is fill/geometry, not logic.** The engine is ~0.04 ms; everything
  above is Canvas 2D draw, now at effective DPR 2 (backing store 780×1688 on the
  emulated phone).

### Cheapest remaining wins for low-end (not yet done)

1. ~~Cap DPR on mobile~~ — **done (marker-0092).** The single biggest win.
2. **Shorten draw distance** on the heaviest terrains (fewer forward strips /
   scenery sprites past the horizon haze).
3. **Skip the second fork ribbon** past the split when far away.

Neither remaining item is required to ship. Re-run `npm run perf:mobile` after any
renderer change to catch a regression.

### Caveats

Headless Chromium with SwiftShader is not a real GPU or a real phone; the profile
is a **relative** instrument (compare runs, catch regressions), not an absolute
fps promise. A true reading needs the manual pass in [`PLAYTEST.md`](PLAYTEST.md)
on an actual device.
