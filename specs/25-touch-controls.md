# 25 — Mobile touch controls

Established in `marker-0025` (slice-017). On-screen touch controls so the game is
playable on a phone. Client-only — no engine change, no repin.

## Layout (`client/touch_controls.js`)

Canvas-fraction button zones (`BUTTONS`): bottom-left `◄`/`►` steer, bottom-right
`BRK`/`GAS`, top corners `Q`/`E` fork. Pointer events map to the same input the
keyboard yields:
- **Held** buttons (steer/accel/brake) track active `pointerId`s → `readTouchInput()`
  reduces them to `{ steer, accel, brake }`.
- **Fork** buttons are edge-triggered (one tap = one choice) via `readTouchFork()`.

Multi-touch works (steer + gas at once = distinct pointers). `drawTouchControls`
renders the overlay (faint; brighter while held).

## Integration (`client/main.js`)

Keyboard and touch are **merged** each frame (`kb.steer || tc.steer`, etc.), so
either works. The overlay shows when `touchDetected()` (maxTouchPoints /
ontouchstart) or `?touch=1` is set (so you can preview it on desktop).

## Verified (headless, §17 / gotcha #10)

`test/touch_controls.test.js` drives **synthetic pointer events** at button
centres: hold-to-steer with release, multi-touch steer+gas, edge-triggered fork
(no residual held input), and out-of-bounds taps ignored. Client import gate
covers the module. `./test.sh` → 118/118 + 4 Luau gates.

## Mobile compatibility (marker-0029)

The first cut mapped taps with `offsetX / bufferWidth`, which is only correct when
the canvas is displayed at its native 960×540. On a phone the browser CSS-scales
the canvas to fit, so every touch landed in the wrong button (gotcha #9).

Fixes:
- `eventFraction(canvas, e)` now maps via the canvas **bounding rect + clientX/Y**,
  so hit-testing is correct at any CSS scale/offset (falls back to
  offset/buffer when no rect — older paths/tests). `installTouch(canvas)` uses it.
- `index.html` makes the canvas **responsive** (`width: min(100vw, 177.78vh);
  aspect-ratio: 16/9`) so it fits any screen keeping 16:9, adds
  `touch-action: none` + `user-select: none` (no scroll/zoom while driving), and
  the viewport meta disables pinch-zoom.

Self-tests (`test/touch_controls.test.js`): `eventFraction` rect + fallback
paths, correct hit-testing on a **CSS-scaled + offset** canvas (the mobile bug),
multi-touch on a scaled canvas, and a button-layout sanity check
(unique/in-bounds/non-overlapping).

## Not verified

Real on-device ergonomics and high-DPR crispness (the 960 buffer is CSS-upscaled;
a devicePixelRatio buffer resize is a later polish) still need a native mobile
browser (§17, gotcha #10).
