# 74 — Roblox host layer (playable 3D-Parts build)

Established in `marker-0098`. Adds the Roblox presentation/host layer on top of the
proven Luau engine twin. **No engine/shared/luau-module change** — the five `lune`
parity gates are untouched, so the Roblox sim stays byte-identical to the browser.

## What was missing

The Rojo project already mounted `luau/` → `ReplicatedStorage.Shared` and `data/`
→ `ReplicatedStorage.GameData` (require-able JSON tables), but `src/server` and
`src/client` were empty `optional` paths — the engine had no host. This slice adds
a minimal but playable one.

## Server — `src/server/GameServer.server.luau`

Authoritative, mirrors `server/index.js` + `game_room.js`. Requires the Shared
engine modules + GameData, builds `ctx = {courseSet, carSet, trafficConfig}`, and
runs **one solo race per player** on course 4 (grand_tour) at 20 Hz via a
Heartbeat accumulator: `apply(INPUT)` → optional `apply(FORK)` → `apply(ADVANCE)`.
It streams a per-seat view (`{tick, seat, same-segment traffic}`) each frame over a
`SunsetView` RemoteEvent and reads intents from `SunsetInput`. Finish/timeout loops
into a fresh race (no framing yet). Avatars are disabled (`CharacterAutoLoads =
false`) — the car is a rendered Part.

## Client — `src/client/Main.client.luau` + `Render.luau`

- **Input**: `UserInputService` → the same intent the reducer expects (steer is a
  signed magnitude ±256 = full lock, matching `STEER_UNIT`); W/S/↑/↓ throttle,
  A/D/←/→ steer, Q/E fork. Sent on change / on fork press.
- **Render** (3D Parts "treadmill"): the car stays near the origin and the world
  scrolls toward it. A pooled ribbon of ~80 road Parts is positioned each view
  from a client-side `buildStrips` that walks the course forward, accumulating
  curve (double integral, like `client/road_renderer.js`) and reading hill; traffic
  and boost pads are pooled Parts placed by depth; a chase camera follows the car
  Part each `RenderStepped` (smoother than the 20 Hz state); a `ScreenGui` HUD shows
  speed / timer / BOOST!·FINISH!·TIME UP. Presentation only — no gameplay decisions.

## Determinism / parity

`roblox/src/` is host + presentation; it writes no engine state and changes no
hashed module. The 5 `lune` gates still prove `ReplicatedStorage.Shared` matches
the JS engine byte-for-byte, so the Roblox and browser sims cannot diverge.

## Verified

`rojo build` produces a valid place with `GameServer` / `Main` / `Render` synced and
the lune-only `*-check.luau` excluded (`globIgnorePaths`). `npm test` → 313/313 and
the 5 Luau gates are unaffected (engine untouched). In-Studio play is a manual step
(the user runs `rojo serve` + Connect + Play).

## Not verified / deferred

Actual in-Studio feel (scale constants, camera, road look) needs a play pass. AI
opponents need an `ai_driver` Luau port (JS-only today). Multiplayer/ghosts, race
framing (countdown/lobby/summary), and an art pass (car model, road textures,
skybox, boost VFX, mobile controls) are follow-up slices.
