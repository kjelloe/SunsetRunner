# 37 — Reconnect UI (connection banner)

Established in `marker-0039`. Surfaces the reconnect/drop-in netcode (specs/33) to
the player — the Pitfall write-up calls a visible RECONNECTING banner "most of the
perceived mobile quality". Client-only, no engine change.

## Status state machine (`client/session_remote.js`)

The remote session now exposes `status` and an `onStatus(s)` callback:
`idle → connecting → live`, `live → reconnecting` on a socket drop (then back to
`live` on the next welcome), and `→ run_ended` on a refused reclaim (grace
expired) before it auto-drops back in. It never strands — `run_ended` immediately
sends a fresh join.

## Banner (`client/connection_banner.js`)

`bannerText(status)` maps the state to a message (`CONNECTING…`, `RECONNECTING…`,
`RUN ENDED — DROPPING YOU BACK IN…`; `live`/`idle` → none). `drawConnectionBanner
(g, view, status, frame)` paints a gently pulsing centre banner over the frame in
remote mode. `main.js` draws it each frame using `session.status`; the local
(offline) session never shows it.

## Verified

`test/connection_banner.test.js`: the text mapping (live/idle blank), the draw
fires only when there's a status, and the session status transitions
`connecting → live` on join against a real server. `./test.sh` → 157/157 + 4 Luau
gates.

## Not verified / deferred

On-screen banner look/pulse and the reconnect flow under real mobile backgrounding
need a device (§17). A dedicated tappable "drop back in" button (vs the current
auto-rejoin) and the browser-level strand test (Pitfall #7) remain optional.
