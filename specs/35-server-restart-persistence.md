# 35 — Server-restart persistence

Established in `marker-0037`, the Pitfall write-up's #1-priority gap: moving all
state server-side trades a client-persistence problem for a server one — the token
only helps if the server still remembers the game, and every deploy restarts the
process. This makes a restart a lossless handoff.

## Save / restore (`server/session_store.js`, `server/game_room.js`)

- `room.serialize()` snapshots the whole session — engine state + presence/tokens
  + queued input + ack seqs + the replay log — all JSON-safe.
- `saveSession(path, room)` writes `{ savedAt, room }`; best-effort (any fs failure
  is non-fatal — never take the game down for a bad write).
- `loadSession(path, maxAgeMs)` returns the serialized room, or null if missing,
  unreadable, or **older than the grace window** (every seat would have expired).
- `createRoom(ctx, { restore })` rebuilds from the snapshot. The engine state is
  restored **verbatim** (deterministic — same hash), and every restored seat starts
  disconnected with a **fresh grace clock** (no socket survives a restart), so
  returning players reclaim within the window and the rest are swept.

## Wiring (`server/index.js`)

Persistence is **opt-in via `statePath`** (the standalone entrypoint sets it;
tests pass a temp file or omit it, so they never clobber a shared file):
- boot → `loadSession` (restore if fresh);
- **autosave every 5 s** (a hard crash loses at most that) + **save on `close()`**
  (deploys are graceful);
- **SIGTERM/SIGINT → `close()`** (which saves) → exit, wired **only in the
  entrypoint** so tests don't accumulate signal handlers.

Default state file: `./.state/session.json` (gitignored; keep it OUT of the deploy
sync path and in a service-writable dir).

## Verified

`test/persistence.test.js`:
- serialize → restore reproduces the exact engine hash + tokens, and keeps ticking
  identically;
- `loadSession` rejects a stale file, accepts a fresh one, tolerates a missing one;
- **deploy handoff:** join → play → kill the server → boot a new one on the same
  state file → the restored server resumes the live tick and a `reclaim` returns
  the SAME seat (Pitfall test #4).

`./test.sh` → 150/150 + 4 Luau gates.

## Deferred (still from the write-up)

Screen wake lock, the browser-level strand test (#7, needs a real headless
browser), and a visible reconnect/rejoin overlay (the `onReclaimFailed` hook
currently auto-rejoins).
