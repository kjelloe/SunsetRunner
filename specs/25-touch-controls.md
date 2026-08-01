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

## Not verified

Real on-device layout/ergonomics and canvas devicePixelRatio scaling need a
native mobile browser (§17, gotchas #9/#10). Button rects are a first pass.
