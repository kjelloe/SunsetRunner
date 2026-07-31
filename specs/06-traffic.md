# 06 — Traffic

Established in `marker-0006` (slice-007). Deterministic, segment-seeded traffic
cars. No collision yet — that arrives with the collision slices; this slice only
spawns and moves traffic. Integer only.

## Config (`data/traffic.json`, `shared/traffic_data.js`)

- `density` — cars spawned per segment.
- `lanes` — the `laneX` offsets traffic may occupy.
- `kinds` — `{ id, nameKey, speed }`; validated (unique ids, positive speed).

## State (added)

- `state.traffic[]` — `{ id, segmentId, roadZ, laneX, speed, kind }`.
- `state.spawnedSegments[]` — segments already populated (spawn-once guard).
- `state.nextTrafficId` — monotonic id source.

All three join the hashed state (`engine/snapshot.js`), so the `physics_1a`
golden was **repinned** (a conscious act, logged). Behaviour unchanged — finish
still tick 215.

## Determinism (`engine/traffic.js`, §24 / gotchas #12, #15)

Traffic RNG is seeded **only** from `segment.trafficSeed` — never wall-clock,
never seat order — so a segment spawns the same cars no matter when or by whom it
is reached. The per-car roll order is fixed (`roadZ`, then lane, then kind) so
the byte layout and hash are stable.

- `spawnSegmentTraffic(state, courseSet, cfg, segmentId)` — spawns `density`
  cars into the segment once (guarded by `spawnedSegments`); positions land
  inside `[0, stripCount*ROAD_UNIT)`.
- `advanceTraffic(state, courseSet)` — `roadZ += speed` per car; despawns any car
  that runs off the end of its segment (order-preserving filter).

## Reducer wiring (tick order step 8)

`createInitialState({ trafficConfig })` seeds the start segment. In
`advance_tick`, entering a new segment spawns its traffic (8a), then
`advanceTraffic` moves/despawns everything (8b). With no `trafficConfig` in
`ctx`, spawning is skipped and the traffic array stays empty — existing physics
unit tests are unaffected.

## Client

`client/renderer_canvas.js` `drawTraffic` renders same-segment cars ahead of the
player, back-to-front (kind-coloured). Placement is approximate pending the
native visual-tuning pass (§17); `main.js`/`session_local.js` thread the config.

## Golden

`test/traffic.test.js` pins segment-seeded reproducibility, per-segment distinct
spawns, in-bounds positions, the spawn-once guard, and move/despawn. The
`physics_1a` accel run now starts with **4** cars in the start segment.
