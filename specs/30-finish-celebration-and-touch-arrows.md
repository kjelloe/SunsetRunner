# 30 — Finish celebration & mobile arrow pad

Established in `marker-0031`, from playtest feedback ("finish needs a much better
splash with confetti and fireworks", "mobile needs arrows on screen"). Client-only.

## Finish celebration (`client/celebration.js`)

`createCelebration()` → a cosmetic overlay triggered once the local car's
`finishTicks >= 0`:
- **Confetti** — 180 rotating coloured rectangles falling and recycling.
- **Fireworks** — a radial spark burst on trigger and again roughly every second
  (`frame % 22`); sparks arc under gravity and fade.
- A gradient **FINISH!** banner.

Presentation only, so it uses `Math.random` (not the deterministic engine).
`main.js` triggers/updates/draws it each frame after the world render.

Self-tests (`test/celebration.test.js`): trigger spawns confetti + a burst and
goes active; update keeps particles alive and relaunches fireworks; update/draw
are safe before trigger and don't throw (gradient/save/restore) after; reset
clears.

## Mobile arrow pad (`client/touch_controls.js`)

The on-screen buttons are now an **arrow layout**: left thumb `◄ ►` (steer),
right thumb `▲ ▼` (accelerate/brake), fork `↰ ↱` in the top corners — instead of
the old `GAS`/`BRK` text. Zones stay non-overlapping (guarded by the layout
test); hit-testing already uses the bounding rect (marker-0029) so it's correct
at any CSS scale.

> **Superseded by marker-0157**: steer is now a bottom-centre steering wheel and
> accel/brake a right-side set-speed lever (the fork arrows are unchanged). See
> specs/25 "Current layout" for the live control set.

## Verified / not

`./test.sh` → 139/139 + 4 Luau gates. The celebration particle/state logic and
button layout are tested; the actual on-screen look (confetti density, banner
size, arrow-pad ergonomics) needs a native browser (§17).

## Playtest items now addressed

Sense of speed (29), less-blocky graphics (29), WASD + arrows (29/30),
finish splash (30), mobile arrows (30). Remaining feel: curve/camera tuning and
high-DPR crispness (native-only), and music.
