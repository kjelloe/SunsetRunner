# 14 — AI driver

Established in `marker-0014` (slice-014). A deterministic AI driver as a command
source (§14) — the measurement instrument for sweeps, tuning, and "do systems
fire?" gates.

## The driver (`engine/ai_driver.js`)

`chooseInput(state, seatId) -> { steer, accel, brake }`. Pure, integer, and
**seed-free** (reads only state), so AI-driven runs are perfectly reproducible.

Policy: always accelerate; **hold your lane** — steer only to dodge the nearest
traffic ahead in your lane (`LOOKAHEAD 6000`, within a lane-width), or to recover
when pushed past `ROAD_HALF_WIDTH` off-road. Lane-holding (not centre-seeking) is
deliberate: an earlier centre-seeking policy made a whole field converge on the
centre line and pile up forever. A finished/timed-out seat gets a neutral input.

## Start-lane spread (`engine/state.js`, `engine/sim.js`)

`makeSeat` gained an optional `laneX` (default centre); `createInitialState`
honours per-seat `laneX`. `staggeredSeats(n)` spreads N cars 256 apart, symmetric
about centre, so a field races instead of colliding at the line. Goldens omit
`laneX`, so `checkpoint_1a`/`collision_1a` are unchanged.

## Runner (`engine/sim.js`)

`runAiRace(ctx, opts)` drives every seat with the AI to completion and returns an
event census `{ checkpoints, collisions, timeouts, finishes }` + final hash.
`runCampaign(ctx, opts)` runs it across pinned seeds.

## Verified (JS-only golden)

`test/ai_driver.test.js` — accel-always / hold-lane / dodge / neutral-when-done,
and a pinned solo AI race (finishes tick 215, `finalHash 65793a01af08c340`,
deterministic). The AI is a command source, not part of the cross-language sim
contract, so it is intentionally NOT Luau-twinned; the engine that consumes its
commands is.
