# 59 — Points / scoreboard

Established in `marker-0078`. A server-authoritative score per player, awarded from
race events, shown live and in the race summary. NOT part of the hashed engine
state (like names/presence) — no golden/determinism impact.

## Scoring (`server/game_room.js`)

Each tick, `tick()` scores the just-emitted events onto a per-seat tally
(clamped ≥ 0): checkpoint **+100**, finish **+1000**, traffic/hazard collision
**−30**. `pointsFor(seatId)`. Persisted in serialize/restore.

`viewFor` adds `points` (the viewer's score) and a `scoreboard`
(`{seatId, carId, name, points}` sorted by points desc, tie by seatId).

## Client

- `session_remote` exposes `points` + `scoreboard`.
- HUD shows **SCORE** top-left in multiplayer (`hud.points`).
- The race summary, in multiplayer, is built from the server `scoreboard`
  (ranked by points, real names, car colours) and shows `N PTS`; solo still ranks
  by stage reached.

## Verified

`test/game_room.test.js`: a checkpoint awards points, `viewFor.points` matches
`pointsFor`, and the scoreboard carries the ranked name/points. `./test.sh` →
264/264 + 4 Luau gates.

## Not verified / deferred

Points now CARRY across a RE-JOIN: keyed by a persistent client `pid`
(localStorage, sent on JOIN; `client/player_id.js`), the room accumulates score
under the pid (`playerId` seatId->pid map), so a re-joining player keeps their
total and earns more from the current stage (marker-0080). No solo scoring yet
(multiplayer feature).
