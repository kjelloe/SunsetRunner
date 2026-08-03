# 56 — Cross-hazards (skiers / snowmobiles)

Established in `marker-0066` (tranche 3). Hittable hazards that traverse the road
laterally on snow terrain. Engine + Luau twin; a full golden repin (STATE_VERSION
1 -> 2).

## Model

`state.hazards` (+ `state.nextHazardId`) — each hazard `{ id, segmentId, roadZ,
laneX, vx, kind }`. Kinds: 3 snowmobile (mountain, scenerySet 10), 4 skier
(alpine, scenerySet 11).
- **Spawn** (`spawnSegmentHazards`, in traffic.js, called after the traffic loop
  so traffic rolls are byte-identical): on a snow segment, seed `HAZARD_COUNT`
  hazards from a DISTINCT RNG stream; each starts off one shoulder
  (`±HAZARD_START`) and slides across at `±HAZARD_SPEED`.
- **Advance** (`advanceHazards`, step 8c): `laneX += vx`; despawn past
  `HAZARD_DESPAWN`.
- **Collision** (`resolveHazardCollisions`, step 9b): overlapping a hazard is a
  dead stop + `CRASH_STUN_TICKS` immunity (same as traffic).

Gated by `scenerySet` (10/11), which only course 4 has — so the golden scenarios
(courses 1-2) spawn NO hazards; behaviour there is unchanged, only the state
shape (empty `hazards` + `nextHazardId` + version byte) shifts the hashes.

## Determinism / repins

STATE_VERSION 1 -> 2 (snapshot shape change). Conscious repins (behaviour
identical on the golden courses):
- spine `hashState_spine0` -> `6ed9cababa35b767`
- checkpoint_1a -> `e38e85c1cab7dd85`, collision_1a -> `c7509672e81d797e`,
  fork_1a -> `21ae1f3f755cfa15`, physics_1a t500 -> `1d8e88763c84ae33`,
  AI -> `14fb758bbfccd33a`
- Luau twin mirrors state/traffic/collision/copy_state/snapshot/reducer +
  constants + spine-check version; all 4 gates byte-identical.
- Pinned tick order (CLAUDE.md) gains 8c hazards / 9b hazard collision.

## Render

`renderer_canvas.drawHazards` draws hazards ahead (sprite by kind, colour-rect
fallback); `game_room.viewFor` + `session_remote` carry `hazards` so remote
clients see them.

## Verified

`test/hazards.test.js`: snow-only spawn (alpine skier / mountain snowmobile),
determinism, lateral advance + despawn, dead-stop collision. `./test.sh` ->
249/249 + 4 Luau gates.

## Not verified / deferred

Snowmobile + skier sprites added (marker-0068). Animals-crossing (savanna) hazard is a future extension.
On-screen look needs a browser (§17).
