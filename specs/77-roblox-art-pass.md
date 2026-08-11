# 77 — Roblox art pass (procedural, phased)

Turns the placeholder-box Roblox host into a looking game. **Procedural only** (no
external asset IDs — self-contained, license-clean, matches the browser's no-asset
ethos), **sunset** mood, delivered in **three phases** (user decisions, 2026-08-11).
Presentation only — no engine/shared/luau change, all 6 `lune` gates untouched.

Everything stays treadmill-pooled (create once, reposition per view) and reads the
existing course + biome data (`GameData.scenery`, the same `data/scenery.json` the
browser uses).

## Phase 1 — sky/lighting + biome ground (marker-0102) — DONE

- **Sunset lighting** (`Render.setupLighting`, one-time): warm dusk `ClockTime`
  17.3, orange `Atmosphere` (density/haze/decay), warm ambient + `ColorCorrection`
  tint, and **fog** (`FogStart 340 / FogEnd 720 = N·STRIP_LEN`) so the treadmill's
  draw distance fades into the horizon instead of ending abruptly. No textures.
- **Biome ground**: a big `Grass`-material ground plane under the road, recoloured
  each view to the current segment's `scenerySet` palette (`themeFor` reads
  `GameData.scenery`; `hexToColor3` converts the shared hex palette to `Color3`).
  Grass/sand/snow/etc. match the browser's biome colours; snaps at segment
  boundaries.

## Phase 2 — roadside props + road-surface speed (marker-0103) — DONE

- **Scrolling asphalt bands**: strip colour alternates by `floor(roadZ/ROAD_UNIT)+k`
  parity, so the road surface flows toward the camera with speed.
- **Centre-line dashes**: a pool of white dashes placed at `DASH_SPACING` (3 road
  units), offset by `roadZ % DASH_SPACING` so they scroll and recycle — the
  clearest speed cue.
- **Roadside props**: a pool of biome-tinted foliage balls + grey rocks, placed at
  `PROP_SPACING` (6 road units) just off each shoulder (`ROAD_HALF·SX + 6`),
  side/type keyed to the absolute world slot so a prop is stable as it approaches
  (no jitter). Foliage colour derives from the biome ground.

Deferred: per-biome side ground (water/sand strips that follow the curve) and
richer multi-part trees — folded into the phase-3 / refinement backlog.

## Phase 3 — procedural car model (marker-0104) — DONE

- Low-poly car **rig** (`makeCarRig`): body + darker cabin (rearward) + 4 dark
  wheel cylinders, each a Part at a fixed **local offset**. `placeCar(rig, cf)`
  sets every part `CFrame = cf * offset` — no `Model`/pivot magic, so it can't
  mis-pivot. `setCarShown` toggles a rig's parts.
- Player + the 8 rival pool now use rigs (rivals keep their name-tag Billboard on
  the body, colour-cycled). The player body still tints cyan/white for boost/crash.
  Camera follows `carRig.body`. **Traffic stays as boxes** (obstacles) to keep the
  part count/perf modest.

Deferred to a refinement pass: wedge nose / headlights, traffic as cars, and
per-biome car variety.

## Refinement — match the browser look (marker-0105) — DONE

From a side-by-side of the browser vs Roblox screenshots, brought the Roblox view
much closer (user decisions: procedural gradient sky backdrop + per-biome trees):

- **OutRun sky**: a static stack of big coloured Parts far ahead (`makeSky`,
  `SKY_BANDS` indigo→purple→magenta→orange) — the camera barely moves (treadmill)
  so a fixed backdrop reads as the sky; the ground occludes its lower half at the
  horizon. Lighting toned down (`Brightness` 2.4→1.7, saturation up) so colours
  (the red car) stop washing out; light haze only, the road end is faded manually.
- **Ground** raised to meet the road (kills the dark gap), flat material, biome
  colour brightened toward the browser's vibrant green.
- **Red/white rumble kerbs** (`rumbleL/rumbleR` pools) alternating per strip, and
  the centre line is now **bold yellow** dashes.
- **Far-fade** on the last ~12 road strips so the treadmill dissolves into the sky.
- **Per-biome trees**: palm (tall trunk + wide flat fronds), fir (short trunk +
  tall conical foliage), bush elsewhere, + occasional rocks — each a trunk+canopy
  rig from `scenerySet`.
- **Cars**: windshield + a soft shadow, and lowered so wheels sit on the road.
- **HUD** matches the browser: TIME big centre-top, STAGE bottom-left (cyan, from a
  client-side stage map), SPEED bottom-right.

Deferred: curve-following per-biome side ground (water/sand), roadside billboards,
richer palm fronds, traffic as cars.

## Fixes + features (marker-0106 / marker-0107) — DONE

From playtest screenshots:
- **0106 fixes**: `ZSHIFT` pushes the whole road toward the camera so it reaches the
  screen bottom behind the car; traffic **sorted nearest-first** (the pool showed an
  arbitrary far subset, so the car you hit was invisible — "you just stop"; the white
  "flicker" was the crash-flash on those unseen cars); bigger canopies.
- **0107 features** (clears the deferred list above): per-biome **side ground**
  (`sideL/sideR` from `theme.sideLeft/sideRight`), roadside **billboards** (`signs`
  post + panel), richer **palm fronds** (a second crown layer), and **traffic-as-cars**
  (the traffic pool is now car rigs coloured by kind).

Still deferred: state interpolation (smoother 20→60 fps) and per-biome car variety.

## Determinism / parity

`roblox/src` is host + presentation; it writes no engine state and changes no
hashed module. The 6 `lune` gates and the JS suite are untouched.

## Verified (phase 1)

`rojo build` valid (scenery data mounts as a require-able table; ground + lighting
apply); `npm test` → 316/316 unaffected. In-Studio look is a manual play pass
(scale/colour tuning) — the user confirmed the box placeholders race; this phase
adds ground + sky around them.

## Issues / open

- I can't run Studio — each phase needs a play-test screenshot to tune scale/colour.
- Flat ground doesn't follow hills yet (road may float above it on big crests, seen
  from the side); acceptable with the chase cam, revisit if needed.
- Performance: pooled Parts repositioned per view; prop counts kept modest.
