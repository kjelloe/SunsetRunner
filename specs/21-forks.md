# 21 — Branching forks

Established in `marker-0021`. Milestone 5 begins: deterministic branching routes.
A player commits a fork direction ahead of time; the reducer applies it when the
car reaches the fork.

## Data (`data/roads.json`)

Added course 2 `canyon_split` (startSegment 10): `10 → 11(fork) → {12 left | 13
right} → 14 → finish`. Segment 11 is a fork (`forkLeft 12`, `forkRight 13`,
`next -1`); branches 12/13 grant a checkpoint and rejoin at 14. Left is longer
(500 strips) with a right-hand curve, right is shorter (400) with the mirror
curve — so the choice matters and the geometry is mirror-able (route-fairness,
§16, later). Course 1 (`sunset_coast`) is unchanged.

## Command + state

- `CMD_FORK_CHOICE` `{ type:"forkChoice", seatId, choice(-1|1) }` — sets the
  seat's pending `forkChoice`. Validated (choice must be ±1).
- Seat gains `forkChoice` (0 none / -1 left / 1 right). Hashed → a mechanical
  repin of every course-1 golden (behaviour unchanged; see below).

## Routing (`engine/road_progress.js`)

On crossing a segment boundary, `advanceRoad` routes via
`nextSegment(courseSet, segId, seat.forkChoice)`. For a linear segment the choice
is ignored; for a fork it selects the branch and is then **consumed**
(`forkChoice → 0`) so a stale choice can't affect a later fork. No choice at a
fork defaults **left** (deterministic, matches the loader default).

## Scenario support

`engine/scenario.js` (and the Luau twin) accept `scenario.forkChoices[]`
(`{ tick, seatId, choice }`), applied before that tick's inputs.

## Luau twin

Ported: `state.luau` (`forkChoice`), `snapshot.luau` (serialize it),
`road_progress.luau` (fork routing + consume), `reducer.luau` (forkChoice
command), `scenario.luau` (forkChoices). New gate `luau/fork-1a-check.luau`
(4th Luau gate) — matches JS `d8358de79eb6029f`.

## Golden repins (conscious)

`forkChoice` joining the seat state shifted every course-1 golden hash
(behaviour identical): `checkpoint_1a f817fa6fe43aaf43`, `physics_1a`, `collision_1a
0e231a34e0f33f71`, AI golden `c826f4e86f0f04fa`, and the roads content-hash pin
`7d0880b9b6ede6b3` (course 2 added). New golden `fork_1a` pins a right-choice run
(finish 227, checkpoint@119 on the right branch).

## Verified

`test/forks.test.js` — command purity/validation, the fork_1a golden, left≠right
routing, and left-default. `test/road_data.test.js` — course 2 fork topology.
`./test.sh` → 108/108 + 4 Luau gates.

## Deferred

Client fork UI (a key + course selection — the client still runs course 1) and
route-mirror fairness (needs a mirror transform over the branch geometry, §16.1).
