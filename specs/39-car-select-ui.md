# 39 — Car-select UI

Established in `marker-0041`. Makes the 4-car roster (specs/38) playable: a
pre-race picker chooses which car the client JOINs with. The whole `carId` path
(protocol JOIN → server `addSeat` → seat `carId` → physics) already existed;
this is only the front end. Client-only, no engine change, no repin.

## Flow (`client/main.js`)

Boot has two phases. `carChoiceFromParams` reads `?car=N`: a valid id skips the
overlay and races immediately (parity with `?course=N`); anything else opens the
picker. The session is **not created until a car is chosen**, so the JOIN/local
seat carries the real choice rather than a default.

## Picker (`client/car_select.js`)

Pure cursor logic + a fake-ctx-safe draw:
- `createCarSelect(carSet, carId)` — wrapping cursor (`left`/`right`), `handle(ev)`
  returns `"confirm"` when the current car is chosen.
- `drawCarSelect` — car name, index, and SPEED/ACCEL/BRAKE/GRIP bars scaled
  against fixed reference maxes so they compare across cars.
- `carSelectTouchZone(view,x,y)` — left third = prev, right third = next, centre
  = confirm (tap-to-choose on mobile).

## Input (`client/input.js`)

`readMenuNav()` pops edge-triggered `"left"`/`"right"`/`"confirm"` events
(Arrow/AD + Enter/Space). The frame loop **drains the queue every frame** so it
never leaks (arrow keys also steer during the race) but only the select phase
acts on it.

## Verified

`test/car_select.test.js`: name humanising, `?car` gating, cursor wrap, confirm,
touch zones, a fake-ctx draw, and `readMenuNav` edge events from a simulated
keyboard. `./test.sh` → 168/168 + 4 Luau gates.

## Not verified / deferred

Overlay look/ergonomics need a device (§17). **Car identity on ghosts** (tinting a
rival's sprite by its `carId`, which the view already carries) is the natural
follow-up and still open.
