# 33 — Drop-in / reconnect multiplayer

Established in `marker-0034`, following the Pitfall: Drop-Zone write-up. Server
bookkeeping only — tokens/grace are NOT hashed engine state, so no golden repin.

## The model: connection ≠ presence

The socket drops constantly on mobile (backgrounded tabs freeze; the ws dies with
1006, no handshake). Presence is a server-side fact with a timeout. Once separated,
a backgrounded phone is a normal event, not an error path.

## Server (`server/game_room.js`, `server/index.js`)

- **Seats survive drops.** A `presence` map (seatId → `{ token, disconnectedTick }`)
  sits beside the engine seats. `markDisconnected` records the tick; a **grace
  sweep** in `tick()` frees the seat only after `graceTicks` (default 900 = 45 s).
  The car keeps driving on its last input while disconnected.
- **Identity is a token, not a socket.** `addSeat` mints a `randomUUID` token;
  `welcome` carries it. `reclaim(token)` rebinds — **idempotent** (a live seat just
  clears its clock) and **supersedes** (a reclaim closes any old socket still on
  the seat, code 4000: same person, new tab wins).
- On connect the server sends `hello` (course/tick/seatCount) so a
  connected-but-not-joined client is a spectator with context. On `close` it
  `markDisconnected`s — it does **not** free the seat.

## Client (`client/session_remote.js`)

- **Persist the token** in `localStorage` (injectable `storage` for tests) — the
  token is the autosave, since the server owns all state.
- **Reconnect relentlessly:** on close, retry with backoff (1 s → ×1.7 → 5 s cap);
  **on `visibilitychange → visible`, reconnect immediately** (the radio is back and
  the player is looking — most of the perceived mobile quality).
- **Reclaim on every open** if a token exists, else a fresh join.
- **Never strand the player:** a `reclaim_failed` (grace expired) clears the dead
  token, fires `opts.onReclaimFailed()` for the UI, and drops back in as a fresh
  seat instead of freezing.

## Verified

`test/reconnect.test.js`:
- room grace unit: disconnected seat survives grace then the sweep frees it;
  reclaim idempotent for a live seat;
- ws: drop the socket → reclaim within grace = same seat; grace expiry → reclaim
  refused; reclaim supersedes the old socket (close 4000);
- `session_remote`: a persisted token reclaims the same seat on a fresh session.

`./test.sh` → 145/145 + 4 Luau gates.

## Deferred (from the same write-up)

Server-restart persistence (serialize the session to disk every 5 s + on SIGTERM
so a deploy is a lossless handoff — spec's test #4), screen wake lock, and the
browser-level strand test (#7 needs a real headless browser).
