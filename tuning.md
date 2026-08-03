# Tuning — Sunset Runner feel knobs

The pseudo-3D camera/road feel is controlled by six **renderer-only** parameters
(they are NOT part of the deterministic engine — changing them never touches a
golden or the Luau twin). They can be dialled live in the browser and reported
back, so we can settle on good defaults without an edit/rebuild/retest loop.

## How to use (live, no rebuild)

Add `?tune=1` to the URL to see the current values on-screen (top-left), then
override any of them with URL params:

```
client/index.html?tune=1&hill=200&follow=0.5&depth=0.8
```

Values are **clamped** to the usable range below, so an out-of-range value can't
break the scene (early playtest found `hill=500` clipped the car through crests,
and a very narrow road was thinner than the car). Screenshot the `?tune=1` panel
with values you like and I'll bake them in as the new defaults.

Combine freely with the other switches: `?course=4&tune=1&hill=220`.

## The parameters

| Param | Internal key | Default | Usable range | Sensible A/B band | What it changes |
|-------|--------------|---------|--------------|-------------------|-----------------|
| `depth`  | `camDepth`     | 0.84 | 0.5 – 1.4   | 0.7 – 1.0   | Field of view / flatness. `1/tan(fov/2)`. Higher = narrower FOV, flatter, road reads "longer". Lower = wider/fisheye, more sense of speed. |
| `height` | `camHeight`    | 1500 | 800 – 2400  | 1200 – 1900 | Camera height above the road (world units). Higher = more top-down, you see further ahead; lower = closer to the tarmac, faster-feeling, less look-ahead. |
| `roadw`  | `roadWidth`    | 2000 | 1400 – 3000 | 1800 – 2400 | Road half-width (world units). Lower = narrower road (harder, car fills more of it); below ~1400 the car is wider than the lane. |
| `hill`   | `hillScale`    | 320  | 40 – 320    | 240 – 320   | Crest/dip height. Higher = steeper hills that hide the road beyond a crest; above ~320 the car visually clips through crests. |
| `follow` | `camFollow`    | 0.4  | 0.15 – 0.75 | 0.3 – 0.55  | How much the camera chases your lateral drift. 0 = fixed centre (drift shows fully); 1 = camera locked to the car (drift barely visible). |
| `nearz`  | `playerNearZ`  | 2000 | 1200 – 3200 | 1700 – 2400 | Depth the player car is drawn at → its on-screen size. Lower = bigger car (closer feel); higher = smaller car, more road visible. |

## Notes

- **Per-stage road width.** Each terrain theme can set a `roadScale` in
  `data/scenery.json` (wide for easy stages like beach/wheat ~1.15, slim for
  mountain ~0.85 / alpine ~0.8). It multiplies the base `roadw` per stage, so the
  road visibly narrows on the hard terrains (marker-0062).

- **Engine feel is separate.** Cornering push (`CURVE_PUSH_DEN`), steering
  (`steerHigh`), and crash behaviour live in `engine/` and are part of the
  deterministic contract — they are NOT URL knobs (changing them is a golden-repin
  cycle, not a live tweak). If cornering/steering needs work, that's a separate
  engine slice.
- The knobs are defined in `client/tuning.js` (`TUNING` + `TUNING_FIELDS`) and
  documented in `specs/44-feel-tuning-knobs.md`. Ranges here match the clamps
  there.
- `?mute=1` (audio off) and `?touch=1` (mobile pad on desktop) are unrelated
  switches, handy while tuning.
