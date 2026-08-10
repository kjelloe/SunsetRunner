# 75 — Multiplayer polish (countdown freeze, spectate, rejoin, strand test)

Established in `marker-0099`. Client-only (presentation + reconnect control) — no
engine/shared change, no golden repin, no Luau change. Closes the three open MP
items (plan lines 42, 138, 139).

## 1. Server-authoritative countdown (input freeze + GO!)

The server already owns the pre-race countdown and freezes the sim (game_room;
per-seat view carries `countdown` seconds — marker-0059). The gaps were client
behaviour: `client/main.js` now (a) **freezes input** while `session.countdown > 0`
in remote play — it sends neutral input so client prediction can't lurch ahead of
the frozen server and snap back — and (b) shows the number while it ticks then a
brief **"GO!"** (with a blip) on the `>0 → 0` edge (`prevRemoteCd`/`goAt`).

## 2. Time-up Re-join / Spectate polish

`client/spectate.js` `drawSpectateOverlay` gains an optional `points` arg and shows
the spectated player's current points. `main.js` now cycles the spectate view in
**rank order** (sorted by the server scoreboard) instead of the arbitrary
ghost-view order, and passes that player's points to the overlay. RE-JOIN /
SPECTATE buttons and the mini scoreboard were already there.

## 3. Dedicated rejoin button + strand test

Auto-reconnect (token reclaim, backoff, reconnect-on-visible, never-strand
auto-join) already existed. Added a **manual** path for a stuck radio / long
backoff:

- `client/session_remote.js` `reconnectNow()` — clears the backoff timer and
  reopens immediately if the socket is dead (no-op while live).
- `client/connection_banner.js` `showRejoinButton` / `rejoinButtonRect` /
  `rejoinButtonHit` + a "TAP TO REJOIN NOW" button drawn under the banner while
  `reconnecting`/`run_ended`. `main.js` wires the tap (any phase) and the **R** key.

**Browser-level strand test (Pitfall #7, previously deferred)**: `test/browser_smoke.mjs`
`checkStrand` boots a remote page, **drops the server**, brings it back on the same
port, and asserts via Playwright websocket observation that a **second socket opens
and receives server frames again** — proving the real browser reconnects and the
player is never stranded (ws-refused console noise during the outage is filtered).

## Verified

`test/connection_banner.test.js` (+2): the rejoin button show/hit logic, and a
node-level `reconnectNow` strand test (live → drop server → reconnecting → restart
same port → live again). `npm test` → 315/315; `./test.sh` browser smoke now
includes the strand check (2 sockets, frames resume); 5 Luau gates unaffected
(engine untouched).

## Not verified / deferred

Real feel (countdown/GO! timing, spectate readability, when the rejoin button
should appear vs. trusting auto-reconnect) needs the `PLAYTEST.md` §6 pass.
Mid-race RE-JOIN still restarts from the start (points carry via `pid`); a
resume-from-stage rejoin is a separate future slice.
