# 45 — Forks by lane position

Established in `marker-0048`. A fork is now a **physical** split: with no explicit
Q/E press, the branch follows the car's lateral position — left of centre takes
the left fork, at or right of centre takes the right. You steer into the fork you
want. Engine change → conscious golden repin; Luau twin mirrored.

## Rule (`engine/road_progress.js`, `advanceRoad`)

At a fork segment:
```
let choice = seat.forkChoice;               // explicit Q/E still wins
if (choice === 0 && isFork(cur)) choice = seat.laneX < 0 ? FORK_LEFT : FORK_RIGHT;
```
Explicit choice is unchanged and overrides position (so the client fork buttons
and `forkChoice` command still work). Only the *default* (no press) changed: it
was always-left, now it is position-based. `nextSegment` itself is untouched — it
still defaults left when handed `choice === 0`; the decision moved up into
`advanceRoad` where the seat's `laneX` is known.

## Determinism / repins

- `fork_1a` golden and the Luau fork gate are UNCHANGED — that scenario sets an
  explicit right choice, so the new branch never fires.
- The **JS-only AI golden** (`ai_driver.test.js`) repinned: the AI's lateral
  position at the course-1 fork now routes it into the RIGHT branch (which grants
  a checkpoint), so `checkpoints 1→2`, `lastTick 297→316`,
  `336dc614cd69a85a → 946a2c0bc4652aab`.
- `luau/road_progress.luau` mirrors the same `laneX < 0` branch, byte-for-byte.

## Verified

`test/forks.test.js`: lane position picks the fork (left/right/centre→right), an
explicit choice overrides position, and a centre car matches the explicit-right
route. `./test.sh` → 196/196 + 4 Luau gates.

## Not verified / deferred

The 5-seconds-ahead fork preview (name each branch + on-screen left/right arrow)
is a separate client HUD slice (specs/46). Whether centre-defaults-right feels
right vs. requiring a deliberate lean is a playtest question.
