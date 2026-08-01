# 20 — Projection flip fix (road in the sky)

Established in `marker-0020`. Playtest screenshot
(`debugging/logs/render-screenshot-fail1.png`) showed the road rendered as a
downward "V" in the **upper** half (the sky) with the sunset filling the lower
half — a vertical flip.

## Root cause

`client/projection.js` computed the camera-relative Y as `worldY - -CAMERA.height`
(= `worldY + height`, positive). With `y = h/2 - scale·(positive)·h/2`, nearer
strips (large scale) projected to **negative** y (top of screen / sky).

## Fix

The camera sits `CAMERA.height` **above** the road, so a road point (`worldY≈0`)
is *below* the camera: camera-relative Y = `worldY - CAMERA.height` (negative).
Then `y = h/2 - scale·(negative)·h/2 = h/2 + scale·height·h/2`, so the road lands
**below** the horizon (`y > h/2`) and nearer strips are lower on screen. This
matches the standard pseudo-3D `project()` (Lou's Pseudo-3D page; Jake Gordon's
JavaScript Racer, https://jakesgordon.com/writing/javascript-racer-v1-straight/
— the renderer reference for this project; not vendored here for licensing).

## Self-test (regression)

`test/projection.test.js` now asserts road points (`worldY≈0`) project at
`y >= h/2` and that a nearer strip is lower on screen than a far one — the exact
invariant the flip violated.

## Still open

Camera magnitudes (`height 1500`, `roadWidth 2000`, `depth 0.84`) remain a first
pass; on-screen feel/tuning still needs a native browser (§17). A fuller renderer
pass against the reference (proper segment geometry, hills, sprites) is a
candidate next step.

## Gate

`./test.sh` → 102/102 + 3 Luau gates OK.
