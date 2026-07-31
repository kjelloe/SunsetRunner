# 12 — Same-segment rival collision

Established in `marker-0012` (slice-012). Completes Milestone 3: an arcade
soft-bump between rivals sharing a segment, gated per room, twinned in Luau.

## Rule (`engine/collision.js`, `shared/collision.js`)

Two active, unfinished, non-timed-out seats that are `overlapping` (same segment,
`|Δroadz| < CAR_LENGTH` and `|ΔlaneX| < CAR_WIDTH`) each:
- shed `BUMP_SLOW` (200) speed, and
- are shoved apart by `BUMP_PUSH` (64) laterally (direction by pre-bump lane
  order, tie-broken by seatId), then clamped.
Each bumped seat emits a `collision` event `{ kind:"rival", seatId }`.

**Order-independence (§24, gotcha #15):** all effects are computed from the
pre-bump state into per-seat deltas and applied together, so the outcome never
depends on seat iteration order — the two cars always get equal-and-opposite
shoves and equal speed loss.

## Placement (tick order)

Runs as a cross-seat pass AFTER the per-seat loop, before `advanceTraffic`.
Because the timer/finish steps don't read speed or laneX, this is equivalent to
the §25 step-10 position AND keeps single-seat hashes stable — so `checkpoint_1a`
is byte-unchanged (verified) and needed no repin.

## Gating

Off by default. Enabled per room via `createRoom(ctx, { rivalCollision: 1 })`
(threaded into the sim ctx) or per scenario via `scenario.rivalCollision`. With
0/1 seats it is a no-op.

## Scenario runner (`engine/scenario.js`)

Extended for multiplayer: `scenario.seats[]`, per-input `seatId` (multiple inputs
per tick), and `scenario.rivalCollision`. `collision` joins the pinned census
event set.

## Luau twin

`luau/collision.luau` mirrors the resolver; `luau/reducer.luau` and
`luau/scenario.luau` gained the same gating/multi-seat support.
`luau/collision-1a-check.luau` runs the 2-seat `collision_1a` golden through the
Luau engine — matches JS `28f01c18c272da59`. `test.sh` now runs three Luau gates
(spine, checkpoint_1a, collision_1a).

## Golden & tests

`test/fixtures/collision_1a.json` (two cars co-located at the line, bump apart
over ticks 1–2). `test/collision.test.js` — golden hashes + census, gating
on/off, symmetric shove, and a room-level collision. `checkpoint_1a` unchanged.

## Milestone 3 status

**Complete** (8-player ghost race foundations): ghost filtering, standings,
same-segment collision, both JS and Luau gated. Deferred to later slices: server
replay dump/load (slice-013), traffic collision + AI drivers (Milestone 4), and
client prediction/reconciliation (§21.2).
