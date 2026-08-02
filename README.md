# 🌅 Sunset Runner

**A deterministic, server-authoritative arcade road racer for the browser — with a byte-identical Roblox/Luau twin.**

![tests](https://img.shields.io/badge/tests-185%20passing-brightgreen)
![luau parity](https://img.shields.io/badge/Luau%20parity-4%20gates-brightgreen)
![node](https://img.shields.io/badge/node-%E2%89%A518-informational)
![build](https://img.shields.io/badge/build-none%20(vanilla%20ESM)-blue)
![license](https://img.shields.io/badge/license-MIT-green)

Sunset Runner is an OutRun-style pseudo-3D racer built as a **real-time sibling of a deterministic tactical engine**: the server owns truth, the client predicts and renders, and the whole simulation is integer-only so it reproduces bit-for-bit — including a full **Luau port** that produces the exact same hashes for a Roblox build.

No framework. No build step. No bundler. Just Node.js and vanilla ES modules.

---

## ✨ Features

- 🏎️ **Pseudo-3D road** — scrolling rumble strips, lane markers, hills, curves that physically push the car (brake before the turn, steer through it).
- ⏱️ **Checkpoint timer** — classic arcade extend-your-time loop; finish or time out.
- 🚗 **Traffic & collisions** — deterministic segment-seeded traffic, crash-and-recover, and optional same-segment rival bumps.
- 🍴 **Branching forks** — commit a direction with **Q/E**; three hilly courses — a coast with a fork, a branch, a mirror-fair valley.
- 🏝️ **Per-leg scenery** — each leg after a fork gets its own palette + sprite mix (beach / canyon / forest).
- 🚙 **Car roster + picker** — four balance-swept cars, chosen in a pre-race select screen (`?car=N` to skip).
- 🔊 **Procedural audio** — synthesised engine hum that tracks speed, event SFX, and a chiptune loop (`?mute=1`).
- 🌐 **Drop-in & reconnect multiplayer** — Node `ws` server, up to 8 seats, ghost rivals, live standings, **client-side prediction**, and **token-reclaim reconnect** (survives mobile backgrounding).
- 📱 **Mobile-ready** — on-screen arrow pad, correct touch mapping on CSS-scaled canvases, no page scroll/zoom while driving.
- 🎉 **Finish celebration** — confetti + fireworks.
- 🤖 **AI drivers + sim campaign** — headless balance tooling.
- ⚖️ **Fairness instruments** — route-mirror, car-swap, traffic-swap, and seat-order analysis.
- 🔁 **Replay** — dump any game as a re-runnable scenario; deterministic to the hash.
- 🧬 **Luau twin** — `luau/` reproduces the engine byte-for-byte, gated by `lune`.

---

## 🚀 Quick start

```bash
git clone git@github.com:kjelloe/SunsetRunner.git
cd SunsetRunner
npm install            # only dependency: ws (for the multiplayer server)
```

### Play (solo, offline)

```bash
python3 -m http.server 8000     # serve the repo root
```
Open **http://localhost:8000/client/index.html** and drive with **WASD / arrows**.

- `?course=2` — the branching **canyon_split** (press **Q / E** at the fork)
- `?course=3` — the mirror-fair **mirror_valley**
- `?touch=1` — preview the mobile arrow pad on desktop

### Play (multiplayer)

```bash
npm start              # http + ws server on :8000
```
Open **http://localhost:8000/client/index.html?mode=remote** in two tabs.

### Test

```bash
npm test               # node --test: 185 unit/integration tests
./test.sh              # the above + Luau (lune) cross-language parity gates
```

---

## 🎮 Controls

| Action | Keyboard | Touch |
|---|---|---|
| Accelerate / brake | ↑↓ or W/S | ▲ ▼ |
| Steer | ←→ or A/D | ◄ ► |
| Fork left / right | Q / E | ↰ ↱ |

---

## 🧠 How it's built

```
data/     roads (3 courses), cars, checkpoints, traffic, sprite manifest   (JSON)
shared/   fixed-point math, prng, canonical hashing, loaders, protocol      (pure, Luau-portable)
engine/   apply(state, command) reducer + physics/traffic/collision/AI/scenario/replay
client/   canvas renderer, projection, sprites, input, touch, prediction, sessions
server/   node http static host + ws race room
luau/     Luau twin of shared/ + engine/ (verified byte-identical via lune)
roblox/   Rojo project mounting luau/ into ReplicatedStorage
tools/    asset build, balance sweeps, golden repin
debugging/ replay, sim campaign, fairness reports
test/     node --test suites + pinned golden fixtures
specs/    the design brief + numbered decision docs
```

**Determinism is the contract.** No floats in `shared/` or `engine/`, integer fixed-point (256-unit), a pinned reducer tick order, and no wall-clock in engine state. State is hashed (FNV-1a 64 over canonical bytes) and pinned in golden fixtures. See [`specs/01-determinism-contract.md`](specs/01-determinism-contract.md).

**The Luau twin** mirrors the engine module-for-module. Four `lune` gates re-run the golden scenarios (`spine`, `checkpoint_1a`, `collision_1a`, `fork_1a`) and assert the Luau output matches the JS **byte-for-byte** — so the Roblox build can never silently drift.

**Multiplayer** is server-authoritative: the client sends input intents, the server ticks at 20 Hz and broadcasts per-seat views (self + filtered ghosts + traffic + standings). The client **predicts its own car** and reconciles against each view (§21.2).

---

## 🧪 Testing & determinism

- `npm test` — 185 tests: fixed-point/PRNG/hash vectors, reducer + physics, server room, prediction, fairness, and client module loading.
- `./test.sh` — adds the Luau parity gates ([`lune`](https://lune-org.github.io/docs) required; skipped gracefully if absent).
- `node debugging/replay.mjs` — replay a scenario as a race report.
- `node debugging/sim_campaign.mjs` — AI "do systems fire?" gate across 5 seeds.
- `node debugging/fairness.mjs` — route-mirror / car-swap / traffic-swap report.
- See [`PLAYTEST.md`](PLAYTEST.md) for the manual checklist (visual feel, touch, real-network multiplayer — the things automation can't judge).

---

## 📋 Status

Milestones 1–5 are functionally complete: solo run, server room, 8-player ghost race, collision/traffic/AI, and content (forks, curve physics, sprites, mobile, finish celebration). The engine is deterministic, Luau-twinned, and provably fair.

Open work: native-browser visual/perf tuning (needs playtest screenshots), a Playwright browser smoke test, and car identity on ghosts. Done: a 4-car roster + balance sweep (`tools/sim_sweep.mjs` + `tools/analyze_sweep.py`), the car-select UI, procedural audio, ws server hardening (payload cap + rate limit), per-leg scenery themes, reconnect UI, mobile polish (wake lock, high-DPR crispness), reconnect/drop-in, and server-restart persistence (lossless deploys). See [`plan-implementation-order.md`](plan-implementation-order.md) and [`dev-log.md`](dev-log.md).

---

## 📄 License

[MIT](LICENSE) — new IP. ("OutRun" is a Sega trademark and is **not** used in the game's name, assets, or code.)
