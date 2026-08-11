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

## Done

marker-0098 minimum host; 0100/0101 AI rivals (varied skills); 0102-0107 procedural
art pass (sunset sky, biome ground + side water/sand, rumble kerbs, yellow dashes,
per-biome trees + palm fronds, billboards, car models, traffic-as-cars); 0108 state
interpolation (60 fps); 0109 race framing (3-2-1-GO + finish summary); 0110
real-player multiplayer (one shared 6-seat race, drop-in on an AI seat); 0111 mobile
touch controls; 0112 boost VFX (particle trail + FOV kick); 0113 per-biome car
variety (livery palette); 0114 end-of-race leaderboard (RESULTS panel); 0115 car +
course select (cycle UI — per-player car, shared course); 0116 ready-up lobby (15s
timer / all-ready); 0117 per-biome car shapes (sport/suv/compact/truck/bus/bike);
0118 richer audio (bundled-sound SFX); 0119 points carried across races; 0120
all-time leaderboard (DataStore, shown in the lobby); 0121 fix traffic missing from
the view (Render ipairs crash); 0122 playtest polish — setting-sun disc + fixed
horizon z-fighting, detailed/varied cars (wedge hood/boot, lights, spoiler, hubcaps),
per-biome terrain materials + textured verges, and per-player time-up scoring
(instant score panel + SPECTATE the leader; stages-only reward); 0123 full-width
sunset horizon glow, sculpted higher-poly sports cars (3 variants), and grace-stop
(when only AI remain, end within 5 s and mark those cars STOPPED).

## Not done yet (backlog)

Feel/scale tuning from playtest; verify the bundled SoundIds exist (swap if silent);
optionally an OrderedDataStore board and richer engine audio. The Roblox host is now
a full shared-race game (lobby, framing, MP, AI, art pass, mobile, VFX, scoring).
