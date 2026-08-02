# 44 — Live feel-tuning knobs

Established in `marker-0046`. The pseudo-3D camera/road feel constants — the
single biggest lever on how the game plays, and the one thing that can only be
judged in a real browser (specs/17) — are now **live URL knobs with an on-screen
readout**, so a playtester dials them in and reports the values that feel right
instead of an edit → rebuild → retest round-trip per value. Renderer-only, NOT
part of the deterministic contract; engine goldens and Luau are untouched.

## The knobs (`client/tuning.js`)

One mutable `TUNING` object owns the six feel constants; `projection.js`,
`road_renderer.js`, and `renderer_canvas.js` read it live each frame.

| param | key | default | range | effect |
|-------|-----|---------|-------|--------|
| `depth` | camDepth | 0.84 | 0.3–2.0 | FOV / flatness |
| `height` | camHeight | 1500 | 400–4000 | camera height |
| `roadw` | roadWidth | 2000 | 800–4000 | road width |
| `hill` | hillScale | 180 | 0–600 | crest/dip readability |
| `follow` | camFollow | 0.4 | 0–1 | how much the camera chases drift |
| `nearz` | playerNearZ | 2000 | 500–6000 | player car on-screen size |

`readTuning(params)` parses + clamps to each range and returns only the keys set;
`applyTuning(overrides)` writes them into `TUNING` (boot, from the URL).

## Readout

`?tune=1` draws `drawTuningHud` — a top-left panel listing every knob's current
value and its param name — so a screenshot records exactly what was tuned.

Example: `client/index.html?tune=1&hill=320&follow=0.55&depth=0.7`

## Verified

`test/tuning.test.js`: no-param → no overrides, param→key parsing, per-field
clamping, non-numeric ignored, `applyTuning` writes only known keys, and the HUD
draws. Defaults are unchanged, so `test/projection.test.js` still passes.
`./test.sh` → 194/194 + 4 Luau gates.

## Not verified / deferred

The knobs exist so the *human* pass can happen — the actual good values are still
TBD and come back from playtest. Engine feel (curve push, steering) is NOT here:
those are in `engine/` and changing them is a golden-repin cycle, not a client
knob. In-browser live drag (vs URL params) is a possible nicety later.
