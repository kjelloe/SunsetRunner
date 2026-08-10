# 73 — Boost pads (power-ups)

Established in `marker-0097`. Engine + Luau twin + client render. **Full golden
repin** (STATE_VERSION 2→3, new seat field) + a **new `boost_1a` parity gate**.

## Design — pads are DATA, boost is one field

The only new *hashed* state is `seat.boostTicks`. The pads themselves are **course
data** (`segment.boostPads: [{ roadZ, laneX }]`), read from `ctx` like checkpoints
and curves — never stored in engine state. This keeps the cross-language surface
tiny (one integer field) and mirrors how the engine already treats course content.

- **Pickup** (`engine/boost.js`, tick step 9c): a seat within `PAD_LENGTH` (512)
  along the road and `PAD_WIDTH` (256) laterally of a pad on its segment gets
  `boostTicks = BOOST_TICKS` (40 = 2 s). Pads are fixed markers, not consumed —
  re-crossing refreshes the boost. Order-independent, integer-only.
- **Effect** (`car_physics.stepLongitudinal`): while `boostTicks > 0` the car gets
  `BOOST_ACCEL` (90) extra shove and its cap lifts by `BOOST_SPEED` (512). The
  reducer decrements `boostTicks` each tick (step 3b, next to the crash stun).

`boostTicks` is 0 on every course without pads, so those runs are **behaviour-
identical** — the existing goldens repin only mechanically (version + the new
field), not behaviourally.

## Gating

Pads live only on **course 4** (grand_tour: segments 100/102/106). Courses 1–3
have none, so `checkpoint_1a` / `collision_1a` / `fork_1a` / `physics_1a` / the AI
golden keep their exact simulation and repin only for the version + field bytes.
`boostPads` is added to the course content-drift pin so pad edits can't slip in
silently.

## Proving the twin — `boost_1a`

A new golden scenario (course 4, seed 777, accel-only) picks up the segment-100
centre pad at ~tick 20; boost raises the speed to 2912 (car cap 2400 + 512) before
decaying. `luau/boost-1a-check.luau` re-runs it and asserts byte-parity — the
**5th** `lune` gate (`test.sh` + `test/luau_engine.test.js`). The whole Luau twin
(`constants`, `state`, `car_physics`, `boost` [new], `reducer`, `snapshot`) was
mirrored; `copy_state`/`road_data` needed no change (they copy/carry all fields).

## Repin (conscious, this marker)

STATE_VERSION 2→3. Repinned: `spine_golden.hashState_spine0` (1f5ad3cc9944ec92) +
`luau/spine-check` version; `checkpoint_1a` (2fc22acd892b310d), `collision_1a`
(ffbad0df89bb497e), `fork_1a` (52f3496b79b37d16), `physics_1a` (t500
df45ddf3f1511fb7), AI golden (43762b8616301876); content hash (1338dbe83fe3de41,
+boostPads). All census/finish ticks unchanged (behaviour identical).

## Client

`renderer_canvas.drawBoostPads` draws a glowing cyan double-chevron on the road at
each pad; `drawBoostEffect` radiates cyan speed streaks while the local car boosts.
Presentation only.

## Verified

`test/boost.test.js` (physics boost branch, data pickup on/off, the `boost_1a`
golden, and a behavioural check that speed exceeds the base cap). `npm test` →
313/313; `./test.sh` 5 Luau gates + browser smoke green.

## Not verified / deferred

Feel/placement (pad count, position, BOOST_TICKS/SPEED values, whether pads should
also appear on courses 1–3) needs the `PLAYTEST.md` device pass. Pads are not yet
consumable pickups or lane-choice risk/reward — a later slice could add variety
(shields, slow traps).
