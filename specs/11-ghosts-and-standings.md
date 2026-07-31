# 11 — Ghosts & standings

Established in `marker-0011` (slice-011). Milestone 3 begins: rivals appear as
filtered ghosts, the view carries race standings, and the shared collision
geometry that the collision slice will act on is defined here.

## Collision geometry (`shared/collision.js`)

Pure, integer, Luau-portable. Two cars can interact ONLY on the same segment
(same path branch) — this keeps context independent of projection and of seat
iteration order.

- `CAR_LENGTH = 512` (roadZ proximity), `CAR_WIDTH = 200` (laneX proximity —
  narrower than a lane so adjacent lanes don't touch).
- `inCollisionWindow(a, b)` — same segment + near along the road (ghost highlight).
- `overlapping(a, b)` — in-window AND laterally overlapping (a real bump; used by
  the collision slice).

## Ghost filtering (`server/game_room.js`, §10)

`viewFor(seatId)` now sends each rival as filtered state — `seatId, carId,
segmentId, roadZ, laneX, speed, finishTicks` — plus `collisionActive` (1 when
`inCollisionWindow(self, rival)`). Clients get only what they need to render a
ghost, never full rival state.

## Standings

`computeStandings(seats)` returns `{ seatId, rank, finishTicks }[]`, deterministic
and tie-broken by `seatId` (§24 seat-order / same-tick-finish rules): finished
seats rank ahead by finish tick, the rest by a progress proxy
(`segmentId*1e6 + roadZ`). Added to every view. (The progress proxy is fine for
the linear course; a branch-aware course-distance metric can replace it later.)

## Client

`client/renderer_canvas.js` `drawGhosts` renders same-segment rivals ahead of the
viewer, semi-transparent and back-to-front, outlining any `collisionActive` ghost
so an imminent bump reads on screen. Local play has no ghosts; remote play fills
`state.ghosts` from the view.

## Verified

`test/ghosts.test.js` — window/overlap geometry, filtered ghost shape +
`collisionActive` for co-located seats, and standings ordering with the seatId
tie-break. Engine hash is untouched (all view-level) — `checkpoint_1a` and the
Luau twin stay green, no repin.

## Next

slice-012 same-segment-collision — act on `overlapping` in the reducer (soft
bump), gated by a room `rivalCollision` setting, with a 2-seat golden and a Luau
twin of the collision step.
