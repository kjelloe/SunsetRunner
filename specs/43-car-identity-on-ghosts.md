# 43 — Car identity on ghosts

Established in `marker-0045`. Rival ghosts are tinted by the car they drive, so
players can tell each other apart in a race. Client-only, no engine change, no
repin. Closes the follow-up noted in specs/39.

## Colours (`client/car_colors.js`)

`carColor(carId)` → a per-car identity colour (red/blue/green/gold for the four
roster cars, grey fallback). Kept **out of `data/cars.json`** on purpose — colour
is presentation, so it must not touch the engine content hash. Pure and
node-testable.

## Use

- `drawGhosts` (`renderer_canvas.js`) fills each ghost with `carColor(r.carId)`
  instead of a single flat colour; the ghost object already carries `carId`
  (`ghostFor`, server). The collision-active white outline is unchanged.
- `drawCarSelect` (`car_select.js`) draws the car name in its identity colour, so
  the picker and the in-race ghost agree.

## Verified

`test/car_colors.test.js`: the palette is distinct per car with a fallback, and
an **integration render** with two ghosts (carId 2 and 3) proves both identity
colours actually reach the canvas. `./test.sh` → 187/187 + 4 Luau gates.

## Not verified / deferred

On-screen legibility of the tints needs eyes (§17). The player's own car still
uses the fixed sprite art — tinting it to match would need sprite compositing
(later). A name/number plate above each ghost is a possible richer identity cue.
