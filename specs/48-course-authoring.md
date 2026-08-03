# 48 — Course authoring & the 50-segment structure (design)

Design decision for the "≥50 segments, checkpoints, forks, varied scenery, ~30–60 s
each on Medium" ask + the "what data structure?" question. This spec is the plan;
implementation follows in later markers.

## Recommendation: keep the flat graph-of-segments JSON, extend it additively

`data/roads.json` already models a course as a **flat array of segment nodes**
wired by explicit edges (`next`, `forkLeft`, `forkRight`) plus a small `courses`
array (name + `startSegment`). **Keep this.** Forks make a course a directed graph
(branches diverge and rejoin), so a flat node list with id-referenced edges is the
right, most-extensible shape — you add a segment by appending one object and
wiring it by id. Nesting segments inside a course would fight the rejoin.

## Proposed per-segment schema (additive — existing fields unchanged)

```jsonc
{
  "id": 7,
  "nameKey": "seg.dawn_pier",   // NEW display name (fork preview / HUD) — NOT hashed
  "seconds": 45,                // NEW author intent: target duration @ Medium — NOT hashed
  "stripCount": 720,            // engine-hashed; may be DERIVED from seconds (see build)
  "checkpointTicks": 900,       // time granted on ENTERING this segment (0 = none)
  "next": 8, "forkLeft": -1, "forkRight": -1,
  "curveProfile": [ ... ],      // integer curvature keyframes
  "hillProfile":  [ ... ],      // integer elevation keyframes
  "trafficSeed": 107,
  "scenerySet": 2               // biome/theme id (specs/42): 1 sunset 2 beach 3 canyon 4 forest ...
}
```

New top-level **difficulty** block (drives checkpoint generosity):

```jsonc
"difficulty": {
  "easy":   { "timeScale": 130 },  // checkpoint bonus x1.30 (integer: ticks*scale/100)
  "medium": { "timeScale": 100 },  // baseline
  "hard":   { "timeScale": 75 }
}
```

## Two field classes (determinism)

- **Hashed** (part of the content-drift hash / engine): `stripCount`,
  `checkpointTicks`, `next`, `forkLeft`, `forkRight`, `curveProfile`,
  `hillProfile`, `trafficSeed`, `scenerySet`. Adding/among these = a conscious
  content repin (recorded in dev-log). The engine only ever reads these.
- **Authoring metadata** (NOT hashed): `nameKey`, `seconds`. Display/build only,
  so editing a name never churns a golden. The loader keeps them on the segment
  but the content-hash serializer ignores them.

## Authoring workflow: `tools/build_course.mjs` (planned)

Hand-edit the JSON, then run a generator/validator that:
1. **Derives `stripCount` from `seconds`** at a reference Medium cruise speed, so
   authors think in "this leg is a ~45 s stretch," not raw strip counts.
   `stripCount = round(seconds * TICK_HZ * cruiseSpeed / ROAD_UNIT)`.
2. **Validates the graph**: every `next`/`forkLeft`/`forkRight` resolves; forks
   set both branches and no `next`; branches rejoin; no orphan/unreachable nodes;
   exactly one finish (`next == -1`) reachable per route.
3. **Reports** total route time per branch and flags any leg outside 30–60 s.

## Checkpoints after each segment

Give most segments a non-zero `checkpointTicks` (time granted on entry), tuned so
a clean Medium run refills roughly to par each leg; `difficulty.timeScale` then
makes Easy generous and Hard tight from the SAME course data (no separate courses).

## Scale plan (Milestone 6)

- 50+ segments across a few named biomes (sunset → beach → canyon → forest → city
  → night), several forks that rejoin, each ~30–60 s @ Medium.
- Author in `data/roads.json` (or split into `data/courses/<name>.json` if it gets
  unwieldy — same schema, loader concatenates).

## Open (needs your nod before authoring 50)

Confirm the schema above (esp. `seconds`-derived `stripCount` and the difficulty
`timeScale` model). Then the build order is: loader accepts new fields → difficulty
select UI → `build_course.mjs` → author the 50-segment course → repin.
