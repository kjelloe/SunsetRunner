# 76 — Roblox AI opponents (+ ai_driver Luau twin, ai_1a gate)

Established in `marker-0100`. Ports the AI driver to Luau and adds named AI rivals
to the Roblox host. The engine reducer/hashes are untouched — the AI is a command
SOURCE — but it is proven byte-identical to the JS AI so the Roblox opponents drive
exactly like the browser's.

## ai_driver Luau twin + parity gate

`luau/ai_driver.luau` mirrors `engine/ai_driver.js` exactly (lane-hold + symmetric
traffic dodge, `AI_SKILL` tiers, throttle duty cycle keyed on `state.tick`).
`luau/ai-1a-check.luau` runs the JS AI golden race (seed 12345, course 1, one AI
seat, medium skill) through the Luau reducer + `chooseInput` and asserts the same
result as JS `runAiRace(seed=12345, numSeats=1)`: **tick 307, hash
`43762b8616301876`**. Wired as the **6th** `lune` gate (`test.sh` +
`test/luau_engine.test.js`). This is the first cross-language proof of the AI (it
was JS-only before).

## Roblox rivals

`roblox/src/server/GameServer.server.luau`: each solo race now seats the player
(seat 1) plus **`AI_COUNT` (4) named AI rivals**, spread across lanes (the Luau
`createInitialState` starts every seat at centre, so the server sets each rival's
`laneX` after creation — presentation, not hashed). Each tick, after the player's
input, every rival drives via `ai.chooseInput(state, id, AI_SKILL.medium)` before
`advance_tick`. The per-seat view gains a `ghosts` array (same-segment rivals:
`{seatId, name, carId, roadZ, laneX}`).

`roblox/src/client/Render.luau`: a pooled set of rival Parts (colour-cycled) with a
`BillboardGui` name tag, positioned by depth like traffic from the view's ghosts.

## Determinism / parity

The engine and all existing goldens are untouched; the AI is not part of the
hashed contract. The new `ai_1a` gate makes the Luau AI's behaviour a proven
contract anyway, so browser and Roblox fields race identically.

## Verified

`lune run luau/ai-1a-check.luau` → matches JS. `npm test` → 316/316 (the JS suite
gained the ai-gate runner); `./test.sh` → 6 Luau gates + browser smoke green;
`rojo build` produces a valid place with the rivals wired.

## Not verified / deferred

In-Studio look/feel of the rivals (Part size, name-tag legibility, lane spread)
needs a play pass. AI difficulty selection in Roblox (all rivals are medium today),
rivals rendered when behind the player, and rival-vs-player collision feel are
follow-ups. The other Roblox backlog (multiplayer/ghosts of real players, race
framing, art pass, mobile) is unchanged.
