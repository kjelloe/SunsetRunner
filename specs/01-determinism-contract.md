# 01 — Determinism contract (the pinned spine)

This is the load-bearing contract every later slice and the Luau twin must
honour. Established in `marker-0001`. If any of this changes, it is a conscious
repin recorded in `dev-log.md`.

## Fixed-point conventions (`shared/constants.js`)

| Constant     | Value | Meaning                                    |
|--------------|-------|--------------------------------------------|
| `ROAD_UNIT`  | 256   | one block of forward road progress (roadZ) |
| `LANE_WIDTH` | 256   | horizontal spacing between lanes (laneX)   |
| `SPEED_SCALE`| 256   | internal speed unit (not km/h directly)    |
| `TICK_HZ`    | 20    | authoritative simulation rate              |

Lane centres are symmetric about the road centre: `LEFT_LANE = -256`,
`CENTER_LANE = 0`, `RIGHT_LANE = 256`. Fork choice encodes `-1` left / `1` right.

Rules:
- No floats in `shared/` or `engine/`. No `Math.sin/cos/random`. No wall-clock.
- Signed division is explicit: `truncDivI32` (round toward zero) for quantities
  that must be symmetric under mirroring; `floorDivI32` otherwise. JS and Luau
  must never disagree on a division.

## PRNG (`shared/prng.js`)

sfc32 seeded through `mix32`. `seedSfc32(root)` expands `mix32(root+1..root+4)`
into the four-word state; `sfc32Next(state)` returns `{ value, nextState }` with
`d` as the stream counter. Deterministic and seed-pinned; never `Math.random`.

## Canonical bytes + hashing (`shared/canonical.js`)

Little-endian byte writer over validated integers. State hash is **FNV-1a 64**
computed with four 16-bit limbs (no BigInt) so it ports to Luau integers
unchanged. `hashToHex64(hi, lo)` yields a 16-char hex string.

## State hashing seam (`shared/statehash.js`)

`hashState(state)` serializes the hashable subset to canonical bytes, then
FNV-1a 64s them. Spine scope: `version`, `tick`, `seed`, and the four rng limbs.
Every field added here becomes part of the contract — adding one repins every
affected fixture.

## Reducer tick order (pinned; do not casually reorder)

1. clear per-tick events
2. apply queued player input
3. apply AI input
4. accel / brake / drag
5. steer / lane / drift
6. advance road position
7. resolve forks / checkpoints / finish
8. spawn / update traffic
9. resolve traffic collision
10. resolve rival collision
11. update timer
12. score near-misses / bonuses
13. run invariants (debug/test)
14. hash snapshot when requested

Reordering changes game feel and every hash downstream.

## Golden vectors (`test/fixtures/spine_golden.json`)

Pins `mix32`, `seedSfc32(12345)`, the first 8 `sfc32` outputs, FNV of the empty
and `[1..10]` byte strings, and the spine state hash. The JS unit tests and the
Luau parity runner (`luau/spine-check.luau`) both assert against this one file,
so the two languages cannot drift apart silently.

## Luau twin

`luau/` holds `--!strict` twins of the spine modules with stable EXPORTS and a
pinned gate in each header. Verified byte-identical to JS via `lune` in
`test/luau_twin.test.js`. Further engine twins are batched after Milestone 1.
Discipline reference: RetroMultiCiv's `luau/`.
