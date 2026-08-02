# 36 — Mobile polish: high-DPR canvas + wake lock

Established in `marker-0038`. Two client-only mobile quality wins; no engine change.

## High-DPR crispness (`client/viewport.js`)

The canvas kept a fixed 960×540 drawing buffer, CSS-scaled to fit the screen — so
on a retina/mobile display the buffer was upscaled and soft. `computeBufferSize
(cssW, cssH, dpr, maxW)` sizes the buffer to the displayed CSS width × device
pixel ratio, keeping 16:9, with a floor (320) and a cap (1920 by default) so a
4K/3× phone doesn't render a needlessly huge, slow frame.

`main.js` `fit()` sets `canvas.width/height` from the bounding rect × DPR on boot,
`resize`, and `orientationchange`, and updates the render `view`. The projection
uses `view.w/h`, so it scales up automatically; touch mapping already uses the
bounding rect (CSS px, marker-0029), so it's unaffected.

## Screen wake lock (`client/wakelock.js`)

A racer's inputs are too intermittent to keep the phone awake. `installWakeLock`
requests a `screen` wake lock (best-effort — unsupported browsers and rejected
requests are silent no-ops), and **re-requests on `visibilitychange → visible`**
(the lock releases when hidden) and on the **first user gesture** (some browsers
require one). `nav`/`doc` are injectable for headless tests.

## Verified

`test/viewport.test.js`: DPR scaling + 16:9, the cap and floor; wake lock requests
when supported, re-requests on visible, releases, and is a safe no-op when
unsupported. Import gate covers both modules. `./test.sh` → 154/154 + 4 Luau gates.

## Not verified

Actual on-device sharpness and whether the wake lock holds through a real drive
need a physical phone (§17).
