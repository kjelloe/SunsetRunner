# 53 — Server-authoritative race framing

Established in `marker-0059`. Moves the pre-race countdown and difficulty into the
room so multiplayer seats start together on a shared GO and the first joiner's
difficulty applies to everyone. Server + client wiring; NO engine change, no repin
(the room orchestrates; the reducer is untouched apart from the already-existing
`ctx.timeScale`).

## Shared countdown (`server/game_room.js`)

A room-level freeze: while `countdownRemaining > 0`, `tick()` decrements it and
**returns without advancing the sim** — every seat's clock and car are held until
GO. It begins when the first seat joins an empty room (drop-in players mid-race
don't restart it). `viewFor` carries `countdown` (seconds until GO); the client
draws it (`drawCountdownLabel`). `countdownTicks` defaults to **0** (off) so unit
and integration tests are unaffected; the standalone server sets **60** (3 s).

## Room difficulty

`simCtx.timeScale` (default 100 = medium) is set by the **first** joiner and then
locked; later joins don't change it. `addSeat(carId, timeScale)` takes it; the
reducer already scales checkpoint bonuses by `ctx.timeScale` (specs/50). It is
included in `serialize()`/`applyRestore` so difficulty survives a server restart,
and a restored room is marked past its countdown.

## Protocol + client

- `protocol.js` `JOIN` gains an optional `diff` (`easy|medium|hard`, else `null`);
  `server/index.js` maps it via `DIFFICULTY` and passes the first joiner's to the
  room.
- `session_remote` sends `diff` on JOIN and exposes `session.countdown`.
- `main.js` now shows the difficulty picker in remote too (the pick is sent; the
  server honours the first), and draws the server-driven countdown.

## Verified

`test/game_room.test.js`: countdown freezes the sim (clock held, `tick` doesn't
advance) then GO advances; first-joiner difficulty locks; default medium.
`test/protocol.test.js`: JOIN with/without/bad `diff`. `./test.sh` → 233/233 + 4
Luau gates.

## Not verified / deferred

Real multi-tab countdown sync needs a browser (§17). Server-driven **race end /
summary / restart for all seats** and the multiplayer **time-up spectate + points**
are still to come (the local summary is specs/51).
