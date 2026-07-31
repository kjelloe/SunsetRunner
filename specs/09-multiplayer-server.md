# 09 — Multiplayer server (room + protocol)

Established in `marker-0009` (slice-009). Milestone 2 begins: a node http host +
`ws` race room that owns the sim and broadcasts per-seat views. No framework —
node `http` serves the static client, `ws` carries the protocol.

## Protocol (`server/protocol.js`)

- **C2S**: `join { carId }`, `input { steer(-1|0|1), accel(0|1), brake(0|1) }`.
- **S2C**: `welcome { seatId, courseId, tick }`, `view { tick, self, ghosts,
  traffic, events, hash }`, `error { reason }`.
- `parseMessage(raw)` validates on the wire — the same integer input contract the
  reducer enforces, so malformed input is rejected without dropping the socket.

## Room (`server/game_room.js`)

`createRoom(ctx, opts)` holds one authoritative race:

- `addSeat(carId)` — drop-in seat at the course start (returns `-1` if full);
  `removeSeat(id)` — mark inactive; capped at `maxSeats` (default 8).
- `setInput(seatId, input)` — queue the latest input per seat.
- `tick()` — drain queued inputs (as `input` commands) then one `advance_tick`;
  the sim stays the pure reducer.
- `viewFor(seatId)` — `{ self (full seat), ghosts (other active seats,
  minified), traffic, events, hash }`. Ghost filtering is minimal here; the
  ghost slice refines it.

Join/leave are room-level actions, not yet reducer commands — noted for a future
replay-complete refinement.

## Host (`server/index.js`)

`startServer(port, roomOpts)` (exported for tests; boots on `PORT` when run
directly): serves `client/ shared/ engine/ data/` static (path-sanitised), runs
the room at 20 Hz, and broadcasts `viewFor` to each client every tick. `npm start`.

## Verified

`test/game_room.test.js` — drop-in, self/ghost split, `maxSeats`, leave, and
deterministic room replay for identical inputs. `test/server_ws.test.js` — a real
`ws` client joins, sends input, and receives a moving view; malformed input gets
an `error` and the socket survives.

## Deferred (later Milestone 2/3 slices)

Client-side prediction + reconciliation (§21.2), true ghost filtering with
`collisionActive`, reconnect, and rate limiting.
