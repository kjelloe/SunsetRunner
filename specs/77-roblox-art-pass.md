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

## Phase 2 — roadside props + road-surface speed (marker-0103) — planned

- Pooled low-poly props (tree = trunk cylinder + cone/sphere canopy, rock, sign)
  placed along the roadside at the theme's interval, biome-tinted, treadmill-
  repositioned; seeded from roadZ so they don't jitter.
- Scrolling centre dashes + coloured rumble edges keyed to `roadZ`, so the road
  surface itself conveys speed (today only approaching objects do).
- Optional per-biome side ground (water/sand strips alongside the road).

## Phase 3 — procedural car model (marker-0104) — planned

- Replace the box with a low-poly car **Model** (body + cabin + wedge nose + 4
  wheel cylinders), tinted per car; player, rivals, and traffic reuse it. Camera
  follows the Model's `PrimaryPart` (small refactor from the bare Part).

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
