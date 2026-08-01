# 27 — Traffic-swap fairness

Established in `marker-0027`. Completes the §16 fairness trio (route-mirror + car-
swap already in). Answers: does traffic accidentally favour a fork branch? No
engine hash change — a measurement, no repin.

## Instrument (`engine/fairness.js`)

`trafficSwapFairness(roadsJson, carSet, trafficConfig, courseId, seeds)`:
- Walks the course from its start to its fork, finds the two branch segments.
- Measures the mean left−right finish delta WITH traffic (`deltaNormal`).
- Swaps the two branches' `trafficSeed`s, reloads, and measures again
  (`deltaSwapped`).
- `residual = deltaNormal + deltaSwapped`.

Reasoning: on a geometrically fair course the whole delta is traffic-induced, so
swapping the seeds swaps the advantage and the deltas cancel (`residual ≈ 0`). A
residual means a geometry/handling bias that survives the swap.

## Findings

- **mirror_valley (course 3):** `deltaNormal 11.9 → deltaSwapped −11.9,
  residual 0` — the traffic advantage negates exactly on swap. The GEOMETRY is
  fair; the entire left/right difference is traffic luck. (Consistent with the
  route-mirror test, which found the no-traffic geometry perfectly fair.)
- **canyon_split (course 2):** `deltaNormal 23.8 → deltaSwapped 21.0,
  residual 44.8` — the bias survives the swap: a real geometry difference (its
  branches are 500 vs 400 strips, intentionally asymmetric), not traffic.

The instrument cleanly separates traffic luck from geometry bias.

## Verified

`test/fairness.test.js` — course 3 residual 0 (`deltaSwapped === -deltaNormal`),
course 2 residual > 20 (geometry bias survives). `node debugging/fairness.mjs`
prints both. `./test.sh` → 125/125 + 4 Luau gates.

## §16 status

All three fairness instruments are in: route-mirror (23), car-swap (18),
traffic-swap (27), plus the seat-order/tie fix (24). Remaining open engineering:
client prediction/reconciliation (§21.2); feel: music, native visual/perf tuning.
