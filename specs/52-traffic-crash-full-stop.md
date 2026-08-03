# 52 — Traffic crash is a full stop

Established in `marker-0056`. Playtest: a partial (÷3) speed cut on hitting a
traffic car made dodging optional and the game too easy. A crash is now a **dead
stop** (`seat.speed = 0`), still followed by `CRASH_STUN_TICKS` of immunity so an
overlapped car doesn't re-crash you every tick (you brake, stop, then drive out).

## Change

`engine/collision.js` `resolveTrafficCollisions`: `seat.speed = 0` (was
`floorDivI32(speed, TRAFFIC_CRASH_DEN)`). `luau/collision.luau` mirrors it.

## Repins (conscious — traffic crashes now stop the car)

Every accel-only/AI golden whose car runs into traffic shifts:
- `checkpoint_1a`: finish 297 → **387**, 3 collisions; finalHash → `073dace971711255`.
- `fork_1a`: finish → **217**; finalHash → `18837aa0a26d9051`.
- `physics_1a`: finish → **387**, t500 hash → `2d3230b23f7fa0b7`.
- AI golden: 316/2cp → **307/1cp** (now takes the left branch); → `f4c71ed1b1ac3f46`.
- Luau checkpoint/fork gates recompute against the repinned fixtures — still
  byte-identical. `collision_1a` (rival bump) is unaffected.

## Verified

`test/collision.test.js` asserts a dead stop + stun. `./test.sh` → 227/227 + 4
Luau gates.
