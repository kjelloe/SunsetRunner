# 10 — Remote session seam

Established in `marker-0010` (slice-010). Completes Milestone 2: the client can
run the same race either offline (local session) or against the server (remote
session) through one interchangeable seam. `main.js` treats them alike.

## The seam

Both sessions expose `setInput(input)` and `getState()` returning a renderable
state whose `seats[0]` is the player. The difference is who advances the sim:

| | local (`session_local.js`) | remote (`session_remote.js`) |
|---|---|---|
| advancement | `tick()` runs the reducer at 20 Hz | server owns it; views arrive |
| authority | client (offline) | server-authoritative |
| getState | its own engine state | assembled from the latest `view` |

## Remote session (`client/session_remote.js`)

`createRemoteSession(url, opts)`:
- `connect()` — opens the socket, sends `join`, then sends the held input every
  `1000/TICK_HZ` ms.
- `onmessage` — `welcome` sets `seatId`; `view` becomes the latest snapshot.
- `getState()` — `{ tick, seats:[view.self], ghosts, traffic, events }`, or an
  empty state before the first view (so the renderer can no-op until ready).
- Import-safe and headless-testable: a WebSocket impl can be injected
  (`opts.WebSocket`); the browser uses the global.

## Client switch (`client/main.js`)

`?mode=remote` joins the ws server room; the default stays an offline local race.
The frame loop sends input every frame and only advances locally in local mode;
in remote mode it renders whatever view the server last sent. Client-side
prediction/reconciliation (§21.2) is a later slice — this seam is the plumbing it
will build on.

## Verified

`test/remote_session.test.js` — end-to-end, headless: the remote session
(injected with node `ws`) joins a real `startServer` room and its `getState()`
tracks the authoritative moving view. Plus the client import gate now covers
`session_remote`.

## Milestone 2 status

**Complete.** Server room, wire protocol, per-seat views, and an interchangeable
local/remote client seam — all gated. Next: Milestone 3 (8-player ghost race:
ghost filtering + finish ordering + server replay).
