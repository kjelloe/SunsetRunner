# Sunset Runner — repo instructions

Deterministic, server-authoritative arcade road racer. Fireline-derived stack
with a RetroMultiCiv-style Luau twin. New IP (do not use "OutRun" in shipped
names/assets — it is a Sega trademark).

## Non-negotiables (the determinism contract)

- **No floats in `shared/` or `engine/`.** Integer fixed-point only. No
  `Math.sin/cos/random`, no `Date.now()`, no wall-clock in engine state.
- **Fixed-point conventions are pinned** in `shared/constants.js`: `ROAD_UNIT`,
  `LANE_WIDTH`, `SPEED_SCALE` = 256; `TICK_HZ` = 20. Never drift these.
- **Reducer is `apply(state, command) -> state`**, pure, never mutates input.
- **Pinned tick order** (do not casually reorder — it changes feel and hashes):
  1 clear per-tick events · 2 player input · 3 AI input · 4 accel/brake/drag ·
  5 steer/lane/drift · 6 advance road · 7 forks/checkpoints/finish · 8 traffic ·
  8c hazards (advance/despawn) · 9 traffic collision · 9b hazard collision ·
  10 rival collision · 11 timer · 12 near-miss/bonus ·
  13 invariants (debug) · 14 hash when requested.
- **Signed division is explicit** — use `truncDivI32` for symmetric (mirrored)
  quantities so JS and Luau never disagree.

## Hashing & fixtures

- State hashing lives in `shared/statehash.js`; every field it serializes is
  part of the deterministic contract. Adding a hashed field = repin every
  affected fixture, and record it in `dev-log.md`.
- Golden vectors are in `test/fixtures/`. Repin is a conscious act with a stated
  reason, never a silent side effect.

## Luau twin

- `luau/` mirrors `shared/` (and, after Milestone 1, `engine/`). Twin cadence:
  **batched after Milestone 1 lands** (per user decision), not per-slice.
- Parity is proven, not assumed: `luau/spine-check.luau` recomputes every golden
  vector; `test/luau_twin.test.js` runs it via `lune` and asserts byte-identity.
- Reference for Luau discipline is **RetroMultiCiv** (`/mnt/c/GIT/RetroMultiCiv`),
  not Fireline (which has no Luau port).

## Workflow

- One slice = one commit tagged `marker-NNNN` in the message, logged in
  `dev-log.md`; roadmap in `plan-implementation-order.md`.
- Tests: `npm test` (or `./test.sh` for JS + Luau parity with a summary).
- Stage specific files. The user handles nothing — you may commit and push on
  `dev_night`. Do not push other branches without asking.
- Stdlib-first; add a dependency only with clear justification.
