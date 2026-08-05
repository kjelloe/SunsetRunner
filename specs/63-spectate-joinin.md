# 63 — Spectate an ongoing race + Join-in

Established in `marker-0086`. A late-comer connecting to a running race watches it,
then presses JOIN IN to drop into the **current stage** — so they only cross (and
score) the stages they actually run from there.

## Server

- `HELLO` now carries `phase` (`idle`/`lobby`/`racing`). The server broadcasts a
  `spectatorView()` (leader POV, all seats as ghosts, `watching:true`, plus
  scoreboard/leaderboard/lobby) to every **non-seated** open socket each tick.
- A JOIN while `phase === "racing"` spawns the seat at `leaderSegment()` (the
  most-progressed seat's segment), not the start. Since points are per checkpoint,
  the joiner earns only stages ahead of that spawn — "join@25, reach@28 = 3".

## Client (`session_remote` + `main`)

On connect the client waits for `HELLO`: `racing` + players → **watch** (no auto
JOIN); else JOIN normally. While `session.watching`, `main` renders the leader
view + a **JOIN IN** prompt (Enter / tap → `session.join()`), which spawns at the
current stage; `WELCOME` clears `watching` and the normal race begins.

## Verified

`test/game_room.test.js`: a late JOIN spawns at the leader's stage (not the
start); `spectatorView` is the leader POV with all seats as ghosts + scoreboard.
`./test.sh` → 285/285 + 4 Luau gates + browser smoke (remote connect still joins
a fresh/idle room normally).

## Not verified / deferred

Real "watch then join mid-race" across tabs needs devices. Spawn is at the
leader's stage (front of the pack); a fairer "median" spawn or a catch-up is a
tuning option. Predicted-self is off while watching (leader view is server-raw).
