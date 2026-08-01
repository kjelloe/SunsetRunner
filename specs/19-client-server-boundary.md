# 19 — Client/server import boundary (playtest bugfix)

Established in `marker-0019`. Fixes a browser-only failure found in playtest:
`npm start` → localhost showed only a blank square, with
`GET /server/protocol.js NS_ERROR_CORRUPTED_CONTENT` / "blocked because of a
disallowed MIME type".

## Root cause

`client/session_remote.js` statically imported `../server/protocol.js`. The
static host (`server/index.js`) only serves `client/ shared/ engine/ data/`, so
the browser's request for `/server/protocol.js` 404'd with an empty content-type.
Firefox blocks an ES module with a non-JS MIME, the whole module graph failed to
load (even in local mode — the import is static and eager), `boot()` never ran,
and only the canvas background rendered.

## Fix

The protocol is a **shared contract** used by both server and client, so it moved
to `shared/protocol.js` (pure — no node deps). `server/protocol.js` was deleted;
`server/index.js`, `server/game_room.js`, `client/session_remote.js`, and the ws
test now import from `shared/protocol.js`. The client no longer reaches into
`server/`.

## Rule

**Client code may only import from served directories** (`client/ shared/
engine/ data/`). Anything the client and server both need is a `shared/` module.
`server/` and node-only code must never appear in the client's import graph.

## Self-tests (would have caught it)

`test/serve_static.test.js`:
- scans every `client/*.js` import and asserts it resolves inside a served dir
  (fails loudly on a `server/*` import), and
- starts the real server and `fetch`es the client-imported modules over HTTP,
  asserting `200` + a `javascript` MIME — reproducing the exact browser failure.

## Not verified here

The blank-square symptom is resolved (modules load, `boot()` runs). Actual
on-screen road/visual feel still needs a native browser (§17) — the projection
magnitudes remain a first pass.
