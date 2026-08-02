# 41 — WebSocket server hardening

Established in `marker-0043`. Defence-in-depth on the ws room against
oversized frames, message floods, and malformed input. Server-only, no engine
change, no repin. The engine is already input-validated (specs/19 `parseMessage`);
this protects the transport around it.

## Payload cap

`WebSocketServer({ maxPayload })` (default 4096 B; `roomOpts.maxMessageBytes`)
rejects any frame larger than a protocol message could legitimately be — the ws
layer closes it with **1009** before it can allocate memory. An app-layer
`text.length` check is kept as belt-and-suspenders.

## Rate limiting (`server/rate_limit.js`)

`createRateLimiter({ capacity, refillPerSec, now })` — a per-connection token
bucket, pure and clock-injectable. Defaults `capacity 60 / refill 40` leave a
20 Hz client (~20 msg/s) generous headroom while cutting off a flood. Over-rate
messages are **dropped silently** (no error reply — that would just amplify a
flood).

## Crash safety

- `parseMessage` already guards `JSON.parse`; bad JSON → an `ERROR` reply, never
  a throw.
- A socket-level `'error'` handler (`ws.terminate()`) stops a bad client (e.g. a
  1009 close) from surfacing as an uncaught exception that kills the process.

## Verified

`test/rate_limit.test.js` (bucket allow/block, timed refill, capacity cap) and
`test/server_ws.test.js` (malformed JSON survives, non-JSON garbage → malformed,
oversized frame → 1009 close + server keeps serving a fresh client, a 200-message
burst is limited without crashing the room). `./test.sh` → 180/180 + 4 Luau gates.

## Not verified / deferred

No per-IP connection cap or auth (single-room LAN/demo scope). A production
deploy behind a proxy would add TLS, connection limits, and an origin check.
