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

## Current layout (marker-0157 — supersedes the button/pad layouts above)

The discrete `BRK`/`GAS` + `◄`/`►` buttons (0025) and the later analog drag PAD
(0087) proved poor on a real phone. The live control set in `client/touch_controls.js`
is now (touch only — keyboard + engine unchanged):

- **Steering wheel** (`STEER_WHEEL` grab band, bottom-centre; rim drawn with only
  its top half on-screen). Horizontal drag from the touch-down anchor steers with
  the same relative mapping as the old pad (`PAD_RANGE` = full lock at ±`STEER_UNIT`),
  springs back to centre on release, and the drawn rim rotates with the lock.
- **Set-speed lever** (`THROTTLE`, vertical slider, right side). The knob is a
  **cruise speed the car holds** — no button-holding. `readTouchInput()` returns
  `{ steer, throttleFrac }` where `throttleFrac` is 0..1 of the car's max; `main.js`
  converts it to accel/brake against the **live** car speed (`spd` vs
  `throttleFrac*maxSpeed`, `SPEED_SCALE/4` deadband to avoid chatter). Default full;
  drag down for corners; value persists across releases. Merge is gated on
  `showTouch`, so a desktop user's default lever never forces the throttle.
- **Fork** arrows unchanged (edge-triggered, top corners, `readTouchFork()`).

High-score **initials** entry (`client/initials_entry.js`) also gained touch:
`tap(view,x,y)` + a shared `initialsLayout(view)` — tap a slot to select it,
on-screen ▲ ▼ change that slot's letter, an ENTER button advances slot-by-slot and
confirms after the 5th (new `"enter"` event; keyboard `"confirm"` still finishes
immediately). See specs/79.

Tests: `test/touch_controls.test.js` (wheel drag + spring-back, lever fraction +
persistence, multi-touch wheel+lever, disjoint control regions) and
`test/initials_entry.test.js` (enter-advances-then-confirms, tap-select + ▲/▼,
inert-after-done). `npm test` 327 green; `npm run test:browser` OK.

## Not verified

Real on-device ergonomics and high-DPR crispness (the 960 buffer is CSS-upscaled;
a devicePixelRatio buffer resize is a later polish) still need a native mobile
browser (§17, gotcha #10).
