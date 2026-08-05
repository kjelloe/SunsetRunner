# 62 — Pre-race lobby + invite/QR

Established in `marker-0085`. In multiplayer, the first joiner opens a LOBBY that
auto-starts after a timer; players can start early, wait, or invite a friend via
a link + QR code. Server-driven; client renders it.

## Server (`server/game_room.js`)

Room phase `idle -> lobby -> racing`. The first `addSeat` enters `lobby` with
`lobbyTicks` remaining (default 0 = no lobby, so tests/the smoke race
immediately; the entrypoint sets **600 = 30 s**). `tick()` freezes the sim in the
lobby and counts down to auto-start (unless paused); `startNow()` launches on the
next tick, `toggleWait()` pauses/resumes. `viewFor().lobby =
{ active, seconds, paused, players[] }`. Protocol gains `START` / `WAIT`.

## Client (`client/lobby.js`)

`drawLobby` shows "STARTS IN Ns" (or WAITING), the players in the lobby, and three
buttons — **START NOW / WAIT / INVITE** — plus a QR overlay. `inviteUrl()` is the
page URL forced to `?mode=remote`; the QR is rendered from the vendored
`qrcode-generator` (`client/vendor/qrcode.min.js`, MIT, mirroring RetroMultiCiv).
`main.js` shows the lobby while `session.lobby.active`; input via taps
(`lobbyTouchZone`) or keys (Enter=start, W=wait, I=invite).

## Verified

`test/lobby.test.js` (zones, inviteUrl, draw + QR panel), `test/game_room.test.js`
(freeze/start-now/auto-start/wait-pause), `test/protocol.test.js` (START/WAIT).
`./test.sh` → 283/283 + 4 Luau gates + browser smoke.

## Not verified / deferred

Real two-tab lobby flow + phone QR scan need devices. Joining a lobby doesn't
reset the timer for late arrivals (a design choice; "wait" covers it). Room list
/ multiple rooms are still out of scope.
