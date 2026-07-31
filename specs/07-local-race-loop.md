# 07 — Local race loop & the checkpoint_1a golden

Established in `marker-0007` (slice-008). Formalizes the headless race loop as a
deterministic **scenario replay** and pins the Milestone 1 golden, `checkpoint_1a`.
This is "replay as bug report" (§21.2) and the cross-language contract seed for
the Luau twin (§15.3).

## Scenario replay (`engine/scenario.js`)

`runScenario(scenario, ctx)` drives the reducer to completion:

- **scenario** — `{ seed, courseId, carId, startTimeTicks, maxTicks, hashTicks[],
  inputs:[{ tick, steer, accel, brake }] }`. Inputs are *changes*: an input
  command is applied only at its scheduled tick; the seat retains held controls
  between ticks (so one `accel:1` at tick 1 holds the throttle down).
- **ctx** — `{ courseSet, carSet, trafficConfig }`.
- Returns `{ state, hashes, census, finalHash, lastTick }`. The loop stops as
  soon as every seat has finished or timed out.

The **census** is the ordered list of seat-level events
(`checkpoint`/`finish`/`timeout` — traffic emits none this milestone). Event
drift is a conscious repin, never silent.

## The fixture (`test/fixtures/checkpoint_1a.json`)

Seed 12345, `sunset_coast`, `red_sprint`, accelerator held from tick 1, default
1500-tick budget, `data/traffic.json`. Pinned:

- hashes at ticks 10 / 100 / 215, `finalHash = aede4f551034a311`,
- `finishTick = 215`, census `[checkpoint@119, finish@215]`.

Hashes at 10/100 match `physics_1a` — the two goldens are consistent by
construction.

## Repin tool (`tools/repin_checkpoint_1a.mjs`)

```
node tools/repin_checkpoint_1a.mjs "why this changed"
```

Refuses to run without a reason, re-runs the scenario, prints the event census
(so drift is visible before it is accepted), and writes the `expected` block
back. Repinning is a conscious act, logged in `dev-log.md`.

## Replay dumper (`debugging/replay.mjs`)

```
node debugging/replay.mjs [fixture.json]
```

Runs a scenario and prints a human race report (end tick, final hash, seat
state, census, live traffic) — no assertions, for eyeballing a run.

## Tests (`test/checkpoint_1a.test.js`)

Every pinned hash, the census (drift tripwire), byte-identical replay across two
runs, and loop termination on completion.

## Milestone 1 status

**Complete** (solo checkpoint run): course/car/traffic data, integer reducer,
pseudo-3D client, checkpoint timer, deterministic traffic, and a pinned
replayable golden. Next: the batched Luau engine twin, then Milestone 2 (server).
