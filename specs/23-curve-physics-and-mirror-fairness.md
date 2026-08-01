# 23 — Curve physics & route-mirror fairness

Established in `marker-0023`. Curves were cosmetic (renderer-only); now they push
the car, and a mirror-fairness instrument proves the push is symmetric.

## Curve physics (`engine/car_physics.js`, `engine/road_progress.js`)

- `curveAt(courseSet, segmentId, roadZ)` — the integer `curveProfile` value under
  the car right now.
- `applyCurvePush(seat, curve)` (tick order step 5b, after steering): the car is
  thrown OUTWARD by `curve * speed / CURVE_PUSH_DEN` (4096) — a right bend
  (`curve > 0`) shoves it left. Uses **`truncDivI32`** (round toward zero) so a
  left curve and its mirror give exactly equal-and-opposite shoves. A floored
  divide would bias one direction — the same class of bug the sibling repos hit.

Now the road's curves matter: an accel-only car drifts on a bend and can run
off-road unless the player counter-steers.

## Mirror course + instrument

- `data/roads.json` gains course 3 `mirror_valley`: `20 → 21(fork) →
  {22 | 23} → 24`, where branch 22 (`[0,1,2,3,2,1,0]`) and 23
  (`[0,-1,-2,-3,-2,-1,0]`) are equal-length geometric MIRRORS.
- `engine/fairness.js` `mirrorFairness(ctx, courseId)` runs an accel-only car
  (no steering, no traffic) down each branch and compares finish tick and final
  drift. Fair ⇔ equal finish AND equal-and-opposite drift.

Measured: **left finish 183 = right 183, drift −18 = −(+18) → FAIR.** The
`notEqual(leftLaneX, 0)` check confirms the curve actually moved the car (physics,
not cosmetic).

## Golden repins (conscious)

Curve drift shifted the course-1/2 goldens (behaviour intent unchanged):
- `physics_1a` (t100/t500) and `checkpoint_1a` (`cb23ee95e6f36118`) — finish still
  266 (drift modest at DEN 4096).
- `fork_1a` — only its `finalHash` (`d09dbb310569a237`); t10/t60/t120 pre-curve.
- AI golden — finish 343, `6a4803fb66324a7b`.
- roads content-hash `7844aea058de58fc` (course 3 added).
- `collision_1a` UNCHANGED — its 60-tick run stays in seg 1's flat lead-in.
All re-verified in Luau (4 gates green).

## Luau twin

`road_progress.luau` (`curveAt`), `car_physics.luau` (`applyCurvePush`),
`reducer.luau` (the step-5b call) — byte-identical.

## Verified

`test/fairness.test.js` mirror-fairness case; `./test.sh` → 113/113 + 4 Luau
gates. `node debugging/fairness.mjs` prints the mirror line.

## Note

`CURVE_PUSH_DEN` (4096) is a first-pass feel value; tune in a native browser
(§17). Traffic-swap fairness (§16.3) and the seat/lane-skew fix remain open.
