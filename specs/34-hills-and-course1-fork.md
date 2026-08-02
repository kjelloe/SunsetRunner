# 34 — Hills + a fork on the default course

Established in `marker-0036`, from the request "make hills and the first fork".

## Hills (renderer)

`hillProfile` is **direct elevation** (rises to a crest and back down), used only
by the renderer as `worldY` — the engine never reads it. It was drawn at
`hill * 40`, too small to see against the 1500-unit camera height. Now
`hill * HILL_SCALE (180)`, so crests and dips actually read on screen (the road
rises over a hill and dips into valleys, entities ride the elevation via `onRoad`).

All three courses gained hill profiles. **Because hills are renderer-only, adding
them to courses 2 and 3 changed NO engine hashes** — `fork_1a` and the mirror/
traffic-swap fairness results are byte-identical. Only the roads content-hash pin
moved.

## The first fork (course 1)

`sunset_coast` (the default course) was restructured so a normal playthrough hits
a fork: `1 → 2 (checkpoint) → 3 (fork) → {4 left | 5 right} → 6 → finish`, with
hills throughout and a bonus checkpoint on the right branch. This changes course-1
engine geometry, so the course-1 goldens were repinned (a conscious act).

## Repins

- Content-hash pin `a483515d79677564` (all courses changed).
- Course-1 engine goldens: `physics_1a`, `checkpoint_1a` (`96c7d18179ba5b92`,
  default-left finish tick 297, checkpoint@108), `collision_1a`
  (`d2f7696101148e38`), AI golden (`336dc614cd69a85a`, finish 297).
- **Unchanged:** `fork_1a` (course 2) and the mirror/traffic-swap fairness — hills
  are renderer-only; course 2/3 curve/structure untouched. All 4 Luau gates
  re-verified.

## Verified

`test/road_data.test.js` — the new `1→2→3(fork)→{4|5}→6` topology and the
16-segment count; `forwardStrips` walks the 1800-strip default-left path.
`./test.sh` → 146/146 + 4 Luau gates.

## Not verified

On-screen hill magnitude (`HILL_SCALE 180`) and whether the crest nicely hides the
road beyond still need a native browser (§17).
