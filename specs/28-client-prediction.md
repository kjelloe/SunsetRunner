# 28 — Client-side prediction & reconciliation

Established in `marker-0028` (§21.2). In remote play the client now predicts its
own car immediately and reconciles against authoritative server views, so input
feels instant while the server stays the single source of truth. Prediction is
client-only; no engine hash change (the reducer never sees the wire `seq`).

## Predictor (`client/prediction.js`)

`createPredictor(courseSet, carSet, opts)` runs the REAL reducer on a single-seat,
**traffic-free** local state — so it predicts exactly the kinematics the engine
would (accel/brake/steer/curve/road), and nothing it can't know (traffic/rival
collisions are the server's).

- `predict(seq, fork)` — advance one tick with the held input, buffered under `seq`.
- `reconcile(serverSelf, ackSeq)` — snap the predicted self to the authoritative
  self, drop inputs `≤ ackSeq`, and **replay** the still-unacked inputs on top.
- `self()` / `pendingCount()`.

A server surprise (e.g. a traffic crash cutting speed) arrives as a correction on
the next reconcile and is replayed forward — the classic predict/replay loop.

## Wire (`shared/protocol.js`, `server/game_room.js`)

- Client `input` carries an optional monotonic `seq`.
- The room records the latest `seq` per seat and echoes it as `view.ackSeq`.
- The reducer is untouched — `seq`/`ackSeq` are transport only (goldens unchanged).

## Session (`client/session_remote.js`)

On `welcome` it builds a predictor (needs `courseSet`/`carSet`, passed from
`main.js`). Each 20 Hz send increments `seq`, sends the input, and `predict()`s the
same tick locally. Each `view` reconciles. `getState()` returns the **predicted**
self as `seats[0]` (instant) with authoritative `ghosts`/`traffic`. With no
course/car data it falls back to the raw view self (unchanged behaviour).

## Verified (headless)

`test/prediction.test.js`:
- prediction is **EXACT** vs a surprise-free (no-traffic) authoritative room over
  60 ticks of steer+accel;
- `reconcile` drops acked inputs and replays the rest to match the room;
- a stale/behind-server ack still lands the predicted self ahead deterministically;
- end-to-end: a remote session against a real server room moves the local car
  immediately.

`./test.sh` → 129/129 + 4 Luau gates. No repin.

## Not verified / open

Smoothing (the reconcile is a hard snap — a visual lerp would hide corrections)
and real-network jitter behaviour need a browser (§17). Client prediction never
becomes authority — the server view always wins (gotcha #11).
