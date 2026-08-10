# Sunset Runner — Roblox host (Rojo)

A playable Roblox build on top of the deterministic engine twin. Rojo is the
source of truth; the `.rbxl`/`.lock` are local and gitignored.

## Layout (`default.project.json`)

| Repo path | Roblox location | Role |
|---|---|---|
| `../luau` | `ReplicatedStorage.Shared` | the engine twin (ModuleScripts; `*-check.luau` ignored) |
| `../data` | `ReplicatedStorage.GameData` | course/car/traffic JSON as require-able tables |
| `src/server` | `ServerScriptService.SunsetRunner` | authoritative tick loop |
| `src/client` | `StarterPlayerScripts.SunsetRunnerClient` | input + 3D-Parts renderer |

## Run it

```bash
rojo serve roblox/default.project.json     # from the repo root
```
In Studio: install the Rojo plugin → open a place → **Connect** → press **Play**.

- **Server** (`GameServer.server.luau`) runs the SAME reducer as the browser/lune
  twin at 20 Hz — one solo race per player on course 4 (grand_tour: traffic, forks,
  checkpoints, boost pads) — and streams a per-seat view.
- **Client** (`Main` + `Render`) sends keyboard intents and renders a 3D-Parts
  "treadmill": the car stays near the origin while the road/traffic/pads scroll
  toward it, shaped by the course curve/hill data, with a chase camera + HUD.

Controls: **W/S or ↑/↓** accelerate/brake · **A/D or ←/→** steer · **Q/E** fork.

## Determinism

The engine is untouched — `src/` is host + presentation only. The five `lune`
parity gates (`spine`, `checkpoint_1a`, `collision_1a`, `fork_1a`, `boost_1a`)
still prove the Luau `ReplicatedStorage.Shared` modules match the JS engine
byte-for-byte, so the Roblox sim can never silently drift from the browser.

## Not done yet (backlog)

AI opponents (needs an `ai_driver` Luau port — it is JS-only today),
multiplayer/ghosts, race framing (countdown/lobby/summary), art pass (real car
model, road textures, skybox), mobile controls. This slice (marker-0098) is the
minimum playable host.
