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

## Troubleshooting — empty world (only baseplate + spawn)

Means the host scripts didn't sync/run. In order:

1. **Reconnect Rojo.** `src/server` + `src/client` are `optional` paths; a session
   connected *before* they existed won't pick them up. Stop `rojo serve`, restart
   it, and click **Connect** again (or Disconnect→Connect in the plugin).
2. **Check the tree.** With Play stopped you should see
   `ServerScriptService.SunsetRunner.GameServer`,
   `StarterPlayer.StarterPlayerScripts.SunsetRunnerClient.{Main,Render}`,
   `ReplicatedStorage.Shared.*`, `ReplicatedStorage.GameData.*`. If they're absent,
   Rojo isn't syncing this project (wrong `rojo serve` path or not connected).
3. **Press Play (F5), read Output.** You should see, in order:
   `[SunsetRunner] server booting…`, `session started for …`,
   `client script running…`, `client render initialised…`,
   `first server view received…`. Whichever line is missing localises the fault;
   paste any red error.
4. The road now builds at **y = 50** (above the baseplate) and lays a straight
   default road even before the first server view — so "empty" now unambiguously
   means the client script never ran (step 1/2), not a camera/scale issue.

## Determinism

The engine is untouched — `src/` is host + presentation only. The five `lune`
parity gates (`spine`, `checkpoint_1a`, `collision_1a`, `fork_1a`, `boost_1a`)
still prove the Luau `ReplicatedStorage.Shared` modules match the JS engine
byte-for-byte, so the Roblox sim can never silently drift from the browser.

## Not done yet (backlog)

Multiplayer/ghosts of REAL players (AI rivals are in — marker-0100), race framing
(countdown/lobby/summary), art pass (real car model, road textures, skybox, boost
VFX), mobile controls, AI difficulty selection, and state interpolation for smoother
motion. marker-0098 was the minimum playable host; marker-0100 added AI opponents.
