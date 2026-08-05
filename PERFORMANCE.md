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

Representative run (headless Chromium; numbers vary ±15% run to run):

| CPU throttle | ~device        | p50 ms | p95 ms | p99 ms | ~fps | frames >16.7 ms | >33.3 ms |
|--------------|----------------|--------|--------|--------|------|-----------------|----------|
| 1×           | desktop        | 3.3    | 4.9    | 6.9    | 303  | 0%              | 0%       |
| 4×           | mid-range phone| 16.0   | 33.9   | 35.4   | 62   | 39%             | 10%      |
| 6×           | low-end phone  | 26.2   | 40.1   | 51.0   | 38   | 100%            | 10%      |

### Reading it

- **Mid-range (4×): a comfortable 60 fps median.** ~39% of frames tick just over
  the 16.7 ms line, so there is occasional micro-jank but no sustained drop; 90%
  of frames stay under the 33 ms (30 fps) floor.
- **Low-end (6×): ~38 fps.** Never holds 60, but 90% of frames clear the 30 fps
  budget — playable, not smooth. This is the class worth optimising for.
- **The cost is fill/geometry, not logic.** The engine is ~0.04 ms; everything
  above is Canvas 2D draw at DPR 3 (the backing store is 1170×2532).

### Cheapest wins for low-end (not yet done)

1. **Cap DPR on mobile** (e.g. clamp `computeBufferSize` to DPR ≤ 2). Backing-store
   fill is quadratic in DPR; 3→2 is a ~2.25× fill reduction for a barely visible
   sharpness loss on a phone.
2. **Shorten draw distance** on the heaviest terrains (fewer forward strips /
   scenery sprites past the horizon haze).
3. **Skip the second fork ribbon** past the split when far away.

None are required to ship — the game is playable across the range today — so they
are logged here rather than built. Re-run `npm run perf:mobile` after any renderer
change to catch a regression.

### Caveats

Headless Chromium with SwiftShader is not a real GPU or a real phone; the profile
is a **relative** instrument (compare runs, catch regressions), not an absolute
fps promise. A true reading needs the manual pass in [`PLAYTEST.md`](PLAYTEST.md)
on an actual device.
