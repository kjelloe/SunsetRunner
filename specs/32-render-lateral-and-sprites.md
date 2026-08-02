# 32 — Lateral render model + sprite-scale fix

Established in `marker-0033`, from playtest: "no entities on the road other than
the car/road/grass/sunset" and "running through the curve only moved the car 1.5
car widths". Two client rendering bugs. No engine change.

## Bug 1 — invisible traffic/scenery

When `data/assets.json` loaded, traffic and scenery sprites were scaled by the
raw perspective `scale` (~0.0003), so `sprite.w * scale` was **sub-pixel** — they
vanished. (The no-assets rect fallback used the projected width, so it *was*
visible — which is why traffic showed before the sprite pipeline landed.)

Fix: `spriteScale(roadHalfPx, sprite, frac)` sizes a sprite to `frac` of the
projected road half-width at its depth (traffic 0.55, scenery 0.9), so it scales
correctly with distance and is always visible.

## Bug 2 — drift barely visible + everything used mismatched lateral units

`drawPlayerCar` mapped `laneX` with a tiny fixed factor (`/MAX_LANE_OFFSET * 0.22`
→ ~107 px at the off-road edge), and the road camera fully followed the car
(`camX = laneX`), so the road slid with the car and cancelled the motion. Traffic
used yet another lateral scale (projection roadWidth units), so it never lined up
with the car for dodging.

Fix — one lateral model, `onRoad(view, camX, dz, laneX)`: every entity sits at a
**lane fraction of the projected road half-width** at its depth, so
`laneX = ROAD_HALF_WIDTH` is exactly the road edge and the player + traffic share
one coordinate (you can line up a dodge). The camera follows the player only
partially (`CAM_FOLLOW 0.4`), so lateral drift stays visible instead of being
cancelled. The player car is drawn at `PLAYER_NEAR_Z` and pinned near the bottom.

## Verified

`test/projection.test.js` `onRoad` case: `laneX 0` = centre, `ROAD_HALF_WIDTH` =
road edge (one road-half from centre), road narrows with distance, and the road
half-width is a real on-screen size (`> 20 px`, so sprites can't be sub-pixel).
`./test.sh` → 139/139 + 4 Luau gates.

## Not verified

Exact camera-follow feel, sprite sizes, and whether laneX↔road-edge now lines up
crisply on screen still need a native browser (§17). Screenshots welcome.
