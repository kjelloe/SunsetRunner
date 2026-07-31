# Sunset Runner

A deterministic, server-authoritative arcade road racer — a real-time sibling of
Fireline Command, with a Roblox/Luau twin (the RetroMultiCiv discipline). New IP.

- JavaScript / Node.js / ESM. **No build step. No framework.**
- Dependency-free `shared/` and `engine/` (integer fixed-point, no floats).
- Server owns truth; the client renders views and predicts locally.
- Canvas 2D pseudo-3D road renderer (WebGL only if profiling forces it).
- Headless simulation, replay-first debugging, golden-hash fixtures.
- Luau twin of the deterministic core, verified byte-identical via `lune`.

See `specs/game-design.md` for the full technical brief and
`specs/01-determinism-contract.md` for the pinned determinism contract.

## Layout

```
data/     roads.json, cars.json, checkpoints.json, traffic.json
shared/   fixedmath, prng, canonical, statehash, constants, road_data, car_data, checkpoint_data, traffic_data  (Luau-portable)
engine/   reducer, state, car_physics, road_progress, traffic, scenario, copy_state, snapshot, commands
client/   index.html, main, projection, road_renderer, renderer_canvas, hud, input, session_local, session_remote
server/   index (http static + ws), game_room, protocol
luau/     Luau twins of shared/ (+ engine/ after Milestone 1)
roblox/   Rojo project mounting luau/ into ReplicatedStorage.Shared
test/     node --test suites + pinned fixtures
tools/    repin_checkpoint_1a.mjs (conscious golden repin)
debugging/ replay.mjs (scenario replay as a race report)
specs/    game-design (brief) + 01 determinism … 07 local race loop
```

## Running the gates

```bash
npm test        # node --test — unit suites, golden fixtures, Luau parity gate
./test.sh       # full self-test: JS suite + Luau (lune) parity, with a summary
```

The Luau parity gate shells out to `lune`; if `lune` is not installed the JS
suite still passes and that one gate is skipped.

## Development discipline

- Slices land as one commit tagged `marker-NNNN` in the message; each is logged
  in `dev-log.md`. The slice roadmap lives in `plan-implementation-order.md`.
- Determinism is the contract: no floats in `shared/`/`engine/`, no wall-clock
  in engine state, pinned reducer tick order. Repinning a golden fixture is a
  conscious act, recorded in the dev log.
