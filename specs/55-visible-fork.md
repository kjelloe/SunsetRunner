# 55 — Visible road fork + course-4 default

Established in `marker-0065`.

## Default course

`grand_tour` (course 4, the 50-stage tour) is now the default: `client/main.js`
defaults `courseId` to 4, and the standalone server passes `courseId: 4`. The old
short course is still `?course=1` — a quick fork+finish test track. `?course=2/3`
unchanged.

## Visible fork in the road

Forks now render as an actual Y-split, not just a branch switch. `forwardStrips`,
once the drawn road passes a fork segment's end, keeps building the **right
branch** in parallel (its own curveProfile) alongside the main **left branch**,
with a lateral `sep` that grows per strip (`SPLIT_SEP_PER_STRIP`). Each post-split
strip carries `forkLeftCurveX` (main pulled left) and `forkRightCurveX` (right
branch pulled right). `drawRoad` draws a road ribbon at each — the grass between
them reads as the fork island, and the two curves diverge (left curve / right
curve) as you approach. Only x shifts per branch; y/half-width are identical at a
strip, so vertical extent is computed once.

## Verified

`test/fork_road.test.js`: `forwardStrips` yields diverging branches past a fork
(right > left, gap grows), no fork fields before a fork, and `drawRoad` renders a
forked road without throwing. `./test.sh` -> 244/244 + 4 Luau gates. Client-only
(+ server entrypoint config), no repin.

## Not verified / deferred

On-screen look of the split needs a browser (§17). Entities (traffic/ghosts) past
the split still sample the single `curveX` centreline, not a chosen branch — fine
in practice (the fork is a decision point). Tranche-3 hazards still pending.
