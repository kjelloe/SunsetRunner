# 04 — Client & pseudo-3D renderer

Established in `marker-0004` (slice-005). The first client: a Canvas 2D pseudo-3D
road, a player car, a speed HUD, keyboard driving, and a local session that
drives the real engine reducer. The renderer is presentation only — it makes NO
gameplay decisions and is NOT part of the deterministic contract (§21.3).

## Float boundary

Projection is inherently fractional, so it lives CLIENT-side in `client/`, never
in `shared/`/`engine/` (which stay integer + Luau-portable). The Luau renderer
will compute its own projection later; projection need not be cross-language
deterministic.

## Modules (`client/`)

| file                | role                                                        |
|---------------------|-------------------------------------------------------------|
| `projection.js`     | `projectPoint()` — pure pseudo-3D projection (node-testable) |
| `road_renderer.js`  | `forwardStrips()` (pure geometry walk) + `drawRoad()`        |
| `renderer_canvas.js`| `render()` — sky, road, car, HUD composition                |
| `hud.js`            | speed readout (`displaySpeed`) + finish flag                |
| `input.js`          | keyboard → integer `{ steer, accel, brake }` frame          |
| `session_local.js`  | `createLocalSession` — setInput / tick / getState seam      |
| `main.js`           | `boot()` + fixed-step loop (20 Hz sim, rAF render)          |
| `index.html`        | canvas host                                                 |

`main.js` runs a 20 Hz accumulator: it applies the read input + `advance_tick`
per sim step and renders every animation frame. `boot()` is DOM-guarded so the
modules import cleanly under node.

## What is verified vs not

- **Verified headlessly** (`test/projection.test.js`, `test/client_imports.test.js`):
  projection monotonicity + centre-x, `forwardStrips` walking the whole course
  and stopping at finish and accumulating curve, every client module importing
  cleanly, `readInput` reducing to integers, and a local session advancing the
  sim deterministically.
- **NOT verified here:** actual visual feel (road speed sensation, curve
  readability, camera tuning). Per brief §17, real FPS/feel needs a native
  browser session; WSL/SwiftShader is correctness-only and Playwright is still
  deferred. The camera magnitudes in `projection.js` are a first pass to be
  tuned in a native run.

## Running

Serve the repo root over http (fetch needs it) and open the client:

```bash
python3 -m http.server 8000   # from repo root
# browse to http://localhost:8000/client/index.html
```
