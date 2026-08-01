# 29 — Sense of speed & graphics pass

Established in `marker-0030`, from playtest feedback ("feels like the car is
standing still", "graphics very blocky"). Client-only, no engine change.

## Root cause of "standing still"

`forwardStrips` computed `worldZ = (k+1)*ROAD_UNIT` — a fixed value per SCREEN row
regardless of the car's `roadZ`. Every frame rendered the identical strip
pattern, so the road never scrolled no matter the speed. (The car was moving; the
road just didn't show it.)

## Fix

`forwardStrips` now folds the car's sub-strip position into each strip:
`worldZ = k*ROAD_UNIT + (ROAD_UNIT - (roadZ % ROAD_UNIT))`, so the nearest strip
slides toward the camera as the car advances (smooth scroll), and a running
`worldStrip` index (absolute-ish) drives the band / rumble / lane-dash / scenery
phase so everything flows toward you with speed.

Self-tests (`test/projection.test.js`): the nearest strip's `worldZ` shrinks as
`roadZ` advances within a strip, and `worldStrip` increments across a boundary —
the road demonstrably scrolls.

## Graphics polish

- **Road:** scrolling two-tone tarmac + red/white **rumble strips** at the edges
  + a dashed yellow **centre line** — the classic OutRun speed cues.
- **Scenery** now hangs on the scrolling `worldStrip` (was static), denser
  (`SCENERY_EVERY 10`), palms + signs alternating on both shoulders — objects
  whip past for motion parallax.
- **Sprites** (`sprite_renderer.js`) are shaped/shaded, not flat rects: cars get a
  gradient body, rounded cabin, windshield, wheels, tail-lights + a soft shadow;
  palms get layered fronds; signs a gradient board. Anti-aliased canvas paths.
- **Horizon haze** blends the far road into the sunset.
- Removed `image-rendering: pixelated` from the canvas (less blocky).

## Controls

`input.js` `preventDefault`s the driving keys (arrows/WASD/Space) so arrow keys no
longer scroll the page while driving. WASD **and** arrows both drive (they always
did — the static road made it look otherwise).

## Not verified

On-screen result, exact scroll rate, sprite look, and `CURVE_PUSH_DEN`/camera feel
still need a native browser (§17). Screenshots welcome — the scroll math is proven
by test, the look is not.

## Still open (from the same playtest)

Finish celebration (confetti/fireworks) and a mobile arrow-pad layout — next.
