# 57 — Real player names

Established in `marker-0076`. Players enter a name that is sent on JOIN and shown
as their tag to rivals (replaces the P{seatId} placeholder). Client + server, no
engine change.

## Flow

- `client/name_entry.js`: `nameFromParams` (?name=… wins, else the localStorage
  `sunset_name`); a typed entry (`createNameEntry`) when neither is set. `main.js`
  adds a `name` phase (multiplayer only, first time); the name is remembered.
- `protocol.js` JOIN gains an optional `name` — sanitised (word/space/dash) and
  capped at 12 chars.
- `server/game_room.js`: `addSeat(carId, timeScale, name)` stores it (default
  `P{id}`); `ghostFor` includes `name`; `nameFor` getter; persisted in
  serialize/restore.
- `session_remote` sends the name on JOIN/reclaim; `renderer_canvas` name tags
  and horizon dots use `ghost.name`.

## Verified

`test/protocol.test.js` (sanitise/cap/null), `test/name_entry.test.js` (param vs
stored, typing/backspace/cap/confirm, remember), `test/game_room.test.js` (name on
ghost + `nameFor`). `./test.sh` → 260/260 + 4 Luau gates.

## Not verified / deferred

On-canvas typing UX needs a device. Local (solo) play defaults to "Player" (no
prompt). A points/scoreboard keyed by name is future work (spectate/time-up).
