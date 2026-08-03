# 54 — Terrain detail (tranche 2)

Established across `marker-0060..0064`. Turns the scenery themes from palette-only
into distinguishable terrains, and reshapes grand_tour around them. Client +
content only; the engine and Luau twin are untouched (course-4 content repins and
one asset-manifest repin only).

## Terrain roster (10)

`data/scenery.json` themes 1-11 (10 used by grand_tour): palm, beach, wheat, lake,
forest, autumn, canyon, mountain, alpine, night. Each theme carries:
- `sky[2]`, `grassA/B`, `rumbleA`, `sprites[]`, `every` (density) — palette.
- `roadScale` (marker-0062) — per-terrain road width (wide beach/wheat, slim
  mountain/alpine); the renderer overrides the base width per frame.
- `sideLeft`/`sideRight` (marker-0063) — a different ground on one/both sides
  (beach = sea right, lake = ponds left); painted over the grass, road covers mid.
- `sheen` 0..1 (marker-0063) — an icy/wet centre strip on alternate bands
  (alpine 0.28, mountain 0.12, night 0.15).

## Sprites (marker-0064)

`tools/build_assets.mjs` catalog gains `fir` (kind `fir`, snow-capped conifer) and
`wheat` (kind `crop`, golden stalks); `sprite_renderer` draws both. Assigned:
forest/mountain/alpine use fir, wheat uses wheat. Manifest repinned (strip
264→356, hash `cf64cb17d40914fc`).

## Course shape (marker-0060)

`build_course` curve profiles have **no sustained straight** (every leg turns —
playtest rule: no straight > ~8 s), stage 1 opens on an S-curve + crest, and the
50-stage main route walks the 10 terrains with 3 terrain-detour forks. Checkpoint
banners (specs/55 via marker-0061) mark each checkpoint.

## Verified

`test/scenery.test.js` (roadScale, sides, sheen, clamps), `test/build_course.test.js`
(no straight, stage-1 showcase, terrain variety), `test/assets.test.js` (manifest
repin), `test/checkpoint_banner.test.js`. `./test.sh` → 241/241 + 4 Luau gates.

## Not verified / deferred (tranche 3)

Hittable hazards — snowmobiles (a new traffic kind) and skiers/animals crossing
the road (a new deterministic cross-hazard entity + Luau twin + golden).
