# 31 — Driving feel: crash stun + cornering

Established in `marker-0032`, from playtest feedback: "holding forward the speed
goes down into corners", "does left-right even matter?", "braking before a turn".
Engine change → conscious repin of all engine goldens + Luau.

## Diagnosis

A tick-by-tick trace of an accel-only run showed the speed drops were **traffic
crashes, not corners** — and a crash fired **every tick** you overlapped a car
(1760 → 800 → 274 → 98 on ticks 113/114/115). That was "can't drive out". Corners
were nearly cosmetic (the curve push only nudged laneX to −18).

## Fixes

1. **Crash stun / immunity.** Hitting traffic still cuts speed to ⅓, but now sets
   `seat.crashedTicks = CRASH_STUN_TICKS (30)`; while it counts down the seat is
   immune, so one encounter = one crash you can recover from (accel-only crashes
   dropped 9 → 2, still finishes). New hashed field `crashedTicks`.
2. **Cornering that matters.** `CURVE_PUSH_DEN 4096 → 320` (much stronger, still
   `truncDivI32`-symmetric), and the car's steering was raised (`steerLow 18→22`,
   `steerHigh 9→14`). Tuned by simulation so that at the sharpest curve:
   - **flat-out** just tips you off-road (peak laneX ~517 > 512) → a speed dip →
     you learn to **brake before the turn**;
   - **braking** keeps you fully on-road (0 off-road ticks) → rewarded;
   - **steering** is now strong enough to hold the line (or overcorrect off it) →
     left/right clearly matters.

## Fairness re-checked

The engine stays symmetric: `mirrorFairness` (no-traffic) is still exact
(183=183, drift −396=−396). Two fairness tests were updated because the physics
invalidated their *assumptions*, not the engine:
- the tie test now uses two SAME-lane cars (a guaranteed dead heat) — ±128
  staggered starts no longer tie under curves;
- traffic-swap residual on the mirror course is now small-but-nonzero (crash-stun
  nonlinearity, ~−12 vs the asymmetric course's ~+27), so that test asserts the
  mirror residual is far smaller than the biased course rather than exactly 0.
  (See specs/27; the clean geometry proof is `mirrorFairness`.)

## Repins

All engine goldens repinned (crashedTicks field + new balance): `physics_1a`,
`checkpoint_1a` (`815e8a04c44fc59a`, finish 279, 2 crashes), `collision_1a`
(`ea720799d79d2321`), `fork_1a` (`24bb509ea5326409`, finish 199), AI golden
(`1d6b97a6d0cda2d2`, finish 238). All 4 Luau gates re-verified.

## Gate / not verified

`./test.sh` → 138/138 + 4 Luau gates. On-screen feel of the new corner balance
(is 517-peak too much? is braking rewarding?) still needs a native browser (§17);
the numbers are tuned by simulation.
