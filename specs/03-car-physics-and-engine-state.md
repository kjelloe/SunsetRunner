# 03 — Car physics & engine state

Established in `marker-0003` (slice-004). First real engine state and the pure
reducer that drives it. Integer-only; honours the pinned tick order (specs/01).

## Engine state (`engine/state.js`)

Array-shaped, integer-only, content threaded as context (not stored in state):

```
{ version, tick, seed, rng,
  race:  { status, courseId, maxSeats },
  seats: [ { id, active, connected, carId, segmentId, roadZ, laneX, speed,
             steerHeld, accelHeld, brakeHeld, finishTicks } ],
  events: [] }
```

Flags are `0/1` ints. `finishTicks = -1` means not finished, else the tick the
seat crossed the line. `createInitialState({ seed, courseSet, carSet, courseId,
seats })` seats each car at the course's `startSegment`, `laneX = 0`, `speed = 0`.

## Commands & reducer (`engine/commands.js`, `engine/reducer.js`)

`apply(state, command, ctx)` is pure — clones via `engine/copy_state.js`, never
mutates input. `ctx` carries `{ carSet, courseSet }` (static content, unhashed).

- **input** `{ type:"input", seatId, steer(-1|0|1), accel(0|1), brake(0|1) }` —
  stores the seat's held controls. Queued per seat; the server applies the
  latest before each tick.
- **advance_tick** `{ type:"advance_tick" }` — steps one tick in pinned order:
  clear events → `tick+1` → for each active, unfinished seat (array order):
  longitudinal (4) → lateral (5) → advance road (6) → finish (7, emits a
  `finish` event).

## Physics (`engine/car_physics.js`, `engine/road_progress.js`)

Car stats come from `data/cars.json` (never code). Tuning constants live in
`car_physics.js`: `NATURAL_DRAG=8`, `ROAD_HALF_WIDTH=512`, `MAX_LANE_OFFSET=1024`.

- Longitudinal: brake dominates accel dominates coast-drag; off-road
  (`|laneX| > ROAD_HALF_WIDTH`) adds `car.offroadDrag`; speed clamped `[0, maxSpeed]`.
- Lateral: steer authority tapers linearly from `steerLow` (slow) to `steerHigh`
  (fast); `laneX += steerHeld * rate`, clamped `±MAX_LANE_OFFSET`.
- Road: `roadZ += speed`; on crossing `stripCount*ROAD_UNIT` advance to
  `nextSegment` (linear this slice); `next = -1` finishes (stop at the line).

Forks, checkpoints, timer, traffic, collision, drift come in later slices.

## Snapshot hash seam (`engine/snapshot.js`)

`hashSnapshot(state)` serializes `version + tick + race + seats` to canonical
bytes and FNV-1a 64s them. Deliberately **separate** from the spine primitive
`shared/statehash.js`: engine-state hashing grows here, so the spine hash — and
its already-shipped Luau twin — stay stable while the Luau engine twin is
deferred to the batched post-Milestone-1 pass. Per-tick `events` are transient
and not hashed. This is the module the Luau twin will mirror later.

## Golden fixture (`test/fixtures/physics_1a.json`)

Seed 12345, `sunset_coast`, `red_sprint`, one seat holding the accelerator:
pinned snapshot hashes at ticks 10 and 100, finish at tick **215**, and the
terminal hash at tick 400. Grows into the `checkpoint_1a` fixture at slice-008.
