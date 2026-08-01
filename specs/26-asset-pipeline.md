# 26 — Asset / sprite pipeline

Established in `marker-0026` (slice-018 — the last numbered slice). Procedural,
dependency-free sprites via a pinned manifest, so gameplay/renderer code
references sprite IDs, never hand-coded coordinates (§18, gotcha #17).

## Manifest (`data/assets.json`, `tools/build_assets.mjs`)

A fixed catalog (player_car, traffic_sedan, traffic_truck, palm, sign) is packed
left-to-right into a logical strip. `buildManifest()` computes each sprite's
`{ x, y, w, h, kind, palette }` and the `stripWidth`/`stripHeight`. Regenerate:
`npm run assets`. `TRAFFIC_SPRITE` maps engine `traffic.kind` → sprite id.

No atlas image is required — sprites are drawn procedurally at runtime; the strip
is a layout the width-pin guards.

## Renderer (`client/sprite_renderer.js`)

`drawSprite(g, sprite, cx, cyBottom, scale)` draws by `kind` (car = body/roof/
shadow, palm = trunk/canopy, sign = post/board) from the palette. `renderer_canvas`
now draws the **player car, traffic, and roadside scenery** (palms/signs placed
every 24 strips, alternating sides, projected) from the manifest, falling back to
a coloured rect only when no manifest is passed. `main.js` fetches
`data/assets.json` and threads it into `render`.

## Strip artifact (`tools/render_asset_strip.mjs`)

`npm run strip` renders the packed sprites into a P6 PPM
(`debugging/logs/asset_strip.ppm`, gitignored) for eyeballing the layout —
dependency-free, no image library.

## Width-pin (§18, gotcha #16)

`test/assets.test.js` pins `stripWidth` (264) and an FNV manifest hash
(`09f1ccd63280f8c8`), asserts `buildManifest()` matches the shipped file (no
uncommitted regen drift), non-overlapping packing, that every renderer-referenced
sprite exists, and that `drawSprite` dispatches every kind. A manifest change
that shifts every sprite can't pass silently.

## Verified / not

`./test.sh` → 123/123 + 4 Luau gates. Actual on-screen sprite look/scale needs a
native browser (§17); the procedural art and `drawSprite` scale factors are a
first pass.

## Milestone 5 status

Forks, curve physics, fork UI + course select, mobile touch, and the asset
pipeline are in. Remaining feel items: music select (client audio), and native
visual/perf tuning. Open engineering: traffic-swap fairness (§16.3), client
prediction/reconciliation (§21.2).
