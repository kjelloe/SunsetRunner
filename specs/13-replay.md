# 13 — Replay dump & load

Established in `marker-0013` (slice-013). A live room can dump its play as a
re-runnable scenario; loading it reproduces the exact final hash — replay as bug
report (§21.2).

## A replay IS a scenario

`server/game_room.js` records seats and input **changes** (only when a seat's
input differs from its last), each stamped with the tick it first takes effect.
`dumpReplay()` returns `{ meta, scenario }` where `scenario` is a normal scenario
plus:
- `maxSeats` — so the hashed `race.maxSeats` matches the live room,
- `runToMaxTicks: 1` — reproduce the exact tick count (don't early-stop on finish).

`engine/replay.js` `runReplay(replay, ctx)` is a thin wrapper over `runScenario`.

## Scenario additions (`engine/scenario.js`)

- `scenario.maxSeats` threads into `createInitialState` (undefined → seat count).
- `scenario.runToMaxTicks` disables the finish/timeout early-stop.

Both are backward-compatible; the `checkpoint_1a`/`collision_1a` goldens set
neither, so they and the Luau gates are unchanged.

## Verified

`test/replay.test.js` — a two-car room with a mid-run input change is dumped and
re-run to the **same final hash**, the replay is self-contained (seed/seats/
inputs/maxSeats), and replaying twice is byte-identical.

## Gotcha found & fixed

The first cut dropped `maxSeats` from the dump, so `race.maxSeats` (8 in the
room, defaulted to 2 in the replay) diverged the hash at tick 1 — a reminder that
**every hashed field must survive the dump** (gotcha #2).

## Deferred

Mid-race join/leave as part of the replay contract (join is still a room action,
not a reducer command); persisting replays to disk (`server/replay_store.js`).
