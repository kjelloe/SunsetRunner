# 64 — Analog steering (STEER_UNIT)

Established in `marker-0087`. Steering input changes from a tri-state (`-1|0|1`)
to a **signed magnitude** in `STEER_UNIT = 256` units: `±256` = full lock,
intermediate values = analog (mobile drag). Physics divides the held magnitude by
`STEER_UNIT`, so full lock is **byte-identical** to the old `±1` — no golden repin,
all four Luau parity gates unchanged.

## The contract

- `shared/constants.js`: `STEER_UNIT = 256`. Not a hashed field; it is a fixed
  divisor, like `LANE_WIDTH`.
- Valid `steer` is any integer in `[-STEER_UNIT, STEER_UNIT]`. Enforced in both
  `engine/commands.js` (`isSteer`) and `shared/protocol.js` (`isSteer`).
- `engine/car_physics.js` `stepLateral`: `laneX += truncDivI32(steerHeld * steerRate, STEER_UNIT)`.
  `truncDivI32` (round toward zero) keeps left/right symmetric so analog values
  mirror exactly (see specs/23).
- `luau/car_physics.luau` mirrors the divide (`fixed.truncDivI32(seat.steerHeld * steerRate, 256)`).

## Why byte-identical for existing goldens

Every golden fixture drives `steer: 0`, and the only non-zero steerer is the
JS-only AI. The AI now emits `±STEER_UNIT` (full lock); `truncDivI32(±256*rate,256)
= ±rate`, exactly the old `±1 * rate`. So the AI golden hash
(`3ce72c5877d79295`) is unchanged and no fixture repins.

## Inputs

- Keyboard (`client/input.js`): `steer = (right - left) * STEER_UNIT` — full lock,
  same feel as before.
- AI (`engine/ai_driver.js`): dodge/recover steer `±1 → ±STEER_UNIT`.
- Touch (`client/touch_controls.js`): the left-thumb region is now an **analog
  drag pad** (`STEER_PAD`), replacing the two discrete `◄ ►` buttons. Touch down
  sets an anchor; horizontal drag maps to steer, `PAD_RANGE` (0.14 of canvas
  width) = full lock, clamped to `±STEER_UNIT`. A thumb dot renders the current
  magnitude. Accel/brake/fork buttons are unchanged.

## Verified

- `test/physics.test.js`: full lock (`steerHeld 256`) = full authority; half lock
  (`±128`) = half shift, symmetric.
- `test/protocol.test.js`: INPUT accepts `[-256,256]`, rejects `±257`/`1.5`.
- `test/ai_driver.test.js`: AI dodge emits `±256`; solo-race golden hash unchanged.
- `test/touch_controls.test.js`: drag-right = `+256`, half-drag = `+128`, release
  = `0`; multi-touch analog steer + gas.
- `./test.sh` → 287/287 JS + 4 Luau gates byte-identical + browser smoke OK.

## Not verified / deferred

Real thumb feel and `PAD_RANGE`/deadzone tuning need a device. No steer smoothing
or return-to-centre spring yet (release snaps to 0). Mobile render perf profile is
still open (separate item).
