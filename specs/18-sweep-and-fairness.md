# 18 — Sweep battery & fairness instruments

Established in `marker-0018`. Balance tooling (§15.5, §16): a CSV sweep over many
race seeds and fairness measurements that separate structural bias from
traffic-seed luck. Enabled by race-seeded traffic (marker-0017).

## Richer AI census (`engine/sim.js`)

`runAiRace` now also returns `winnerSeat`, `winnerCar`, `avgFinishTicks`,
`maxSpeed`, and splits collisions into `collisionsTraffic` / `collisionsRival`.

## Sweep battery (`tools/sim_sweep.mjs`)

```
node tools/sim_sweep.mjs [N] [numSeats]   # RIVAL=0 disables rival collision
```

Emits CSV: `seed, courseId, numSeats, winnerSeat, winnerCar, finishCount,
timeoutCount, avgFinishTicks, collisionsTraffic, collisionsRival, maxSpeed,
resultHash`. For a real balance read use 300+ seeds, not 5 (§15.5).

## Fairness instruments (`engine/fairness.js`, `debugging/fairness.mjs`)

- **`seatOrderFairness(ctx, seeds)`** — two identical cars at mirror-symmetric
  start lanes; counts wins per seat. A fair sim shares wins.
- **`carSwap(ctx, seeds, a, b)`** — a field of car A vs a field of car B over the
  same seeds; average finish tick isolates car strength from route/seat luck
  (§16.2). `data/cars.json` gained car 2 (`blue_bolt`) to have something to swap.

```
node debugging/fairness.mjs [N]
```

## Findings (recorded, like Fireline's)

- **Seat/start-lane skew:** over 40 seeds the left-lane seat (seat 1) wins 29/40.
  A structural lean — flagged for a fairness pass (is it seat-iteration order,
  collision tie-break, or left-lane geometry?). The test asserts only
  non-monopoly, not perfect balance.
- **Roster:** `blue_bolt` (car 2) averages ~245 finish ticks vs `red_sprint`
  (car 1) ~258 on this short course — a mild edge from higher accel/steering.

## Verified

`test/fairness.test.js` — census split + winner, seat-order non-monopoly,
car-swap comparability, and determinism. `./test.sh` → 99/99 + 3 Luau gates.

## Deferred

Route mirror fairness needs forks (Milestone 5); `tools/analyze_sweep.py` (§16)
for large-N aggregation; the seat/lane skew investigation.
