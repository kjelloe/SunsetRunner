# 08 — Luau engine twin

Established in `marker-0008`. The batched Luau port of the engine (deferred until
Milestone 1 landed, per the user's cadence decision). The twin reproduces the
`checkpoint_1a` golden byte-for-byte, proven via `lune`.

## What was ported

Port order followed §20. `luau/` now mirrors the JS engine:

| JS | Luau twin |
|----|-----------|
| shared/prng, fixedmath, canonical, constants, statehash | (spine — since marker-0001) |
| shared/road_data, car_data, traffic_data | road_data, car_data, traffic_data |
| engine/state, car_physics, road_progress, traffic | state, car_physics, road_progress, traffic |
| engine/copy_state, snapshot, reducer, scenario | copy_state, snapshot, reducer, scenario |

`canonical.luau` gained `writeI32LE` (two's-complement; Lua's floored `%` already
yields the unsigned 32-bit form for negatives). Loaders are twin-scope: they
index runnable data; the JS side keeps validation (parity is the twin's job).

## Luau translation rules that mattered

- **Held flags are numbers** (0/1); Luau treats `0` as truthy, so compare `~= 0`
  (never `if seat.brakeHeld`).
- **Arrays are 1-indexed** from `@lune/serde`. A JS `arr[value % len]` becomes
  `arr[(value % #arr) + 1]` — same element. Traffic roll order (roadZ, lane,
  kind) and segment-only seeding must match JS exactly.
- **`continue`** (a Luau extension) mirrors the reducer's early-continue.
- **Snapshot byte layout** is field-for-field identical to `engine/snapshot.js`.

## The gate

`luau/checkpoint-1a-check.luau` loads the same `data/*.json` and
`test/fixtures/checkpoint_1a.json`, runs the scenario through the Luau engine,
and asserts every pinned hash, the final hash, and the event census.
`test/luau_engine.test.js` runs it via `lune` inside `npm test` (skips if lune is
absent); `./test.sh` runs both Luau gates (spine + engine). Result:
`finalHash aede4f551034a311`, identical to JS.

## Rojo

`roblox/default.project.json` mounts `luau/` into `ReplicatedStorage.Shared`, so
every twin module is already available in Studio with no project change.

## Maintenance

From here the twin is kept in lockstep only at milestone boundaries or when a
hashed-state change lands (then repin `checkpoint_1a` in BOTH languages via the
JS tool + re-run the Luau gate). Discipline reference: RetroMultiCiv's `luau/`.
