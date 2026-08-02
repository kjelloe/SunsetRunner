# 42 — Per-leg scenery themes

Established in `marker-0044`. Each leg of a course — especially the divergent
branches after a fork — gets its own palette and sprite mix (beach / canyon /
forest), OutRun-style. Renderer-only; the engine is untouched.

## Theme source: `scenerySet`

Every segment already carries a `scenerySet` id (`data/roads.json`). It is part
of the **content-drift hash** (specs/18) but NOT the engine state hash — the
reducer never reads it, so themes cannot affect determinism or Luau parity.
`marker-0044` spread the ids so branches differ: within each course the two fork
branches and the merge leg now use sets 2/3/4 (beach/canyon/forest); the opening
legs stay set 1 (sunset). **Content hash repinned `a483515d79677564 →
4cdff42d55b0f6af`** — engine goldens and the 4 Luau gates unchanged.

## Themes: `data/scenery.json` + `client/scenery.js`

`data/scenery.json` maps a `scenerySet` id → `{ sky[2], grassA, grassB,
rumbleA, sprites[], every }`. `loadScenery(json)` validates and backfills every
field from a hard fallback; `themeFor(config, scenerySet)` resolves id → config
default → hard fallback, so the renderer never gets null.

## Renderer

`render(g, view, state, courseSet, assets, scenery)` resolves the theme off the
current segment's `scenerySet` and threads it into the sky gradient, `drawRoad`
(grass/rumble), and `drawScenery` (sprite kinds + density `every`). The theme
switches as you cross into a new leg. Sprites reuse the existing `palm`/`sign`
art (recoloured context); dedicated per-biome art is a later asset-pipeline task.

## Verified

`test/scenery.test.js`: theme parse + field backfill, malformed-theme repair,
id→theme mapping with distinct palettes, default/hard fallback, and that **every
shipped segment's `scenerySet` resolves to a real theme**. `test/road_data.test.js`
content-hash repin. `./test.sh` → 185/185 + 4 Luau gates.

## Not verified / deferred

Actual look per biome needs eyes (§17). Only palette + sprite mix vary today;
dedicated beach/canyon/forest sprite art (surf, rock arches, pines) is the
follow-up once the asset pipeline grows those.
