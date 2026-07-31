# Dev Log — Sunset Runner

Slice-by-slice build of a deterministic arcade road racer, per the brief in
`specs/game-design.md`. Each entry maps to one git commit tagged `marker-NNNN`
in its message.

---

## marker-0001 — Deterministic spine + Luau twin seam (2026-07-31)

**Goal:** stand up slice-001 (project skeleton) and slice-002 (prng / fixed /
hash) with a first pinned fixture, and — per the user's added requirement —
establish the Roblox/Luau twin seam from day one, verified byte-identical.

**Decisions (this session):**
- Session scope = deterministic spine only.
- Reuse Fireline's already-pinned deterministic core verbatim (proven,
  Luau-twinned math), rather than re-deriving it.
- Project name = **Sunset Runner** (new IP; "OutRun" is a Sega trademark).
- Grow the harness incrementally, not the full Fireline layout up front.
- Luau twin cadence: seam now; further twins **batched after Milestone 1**.

**Built:**
- `shared/{fixedmath,prng,canonical}.js` — copied verbatim from Fireline's 1E
  contract: 256-unit integer fixed-point, sfc32/mix32 PRNG, LE byte writer +
  FNV-1a 64 via 16-bit limbs (no BigInt — Luau-portable by construction).
- `shared/constants.js` — pinned racer fixed-point conventions (ROAD_UNIT /
  LANE_WIDTH / SPEED_SCALE = 256, TICK_HZ = 20, lane offsets, fork codes,
  STATE_VERSION).
- `shared/statehash.js` — the hashing seam. Spine scope hashes version / tick /
  seed / rng limbs; grows field-by-field as the reducer gains state.
- `luau/{prng,fixedmath,canonical,constants,statehash}.luau` — `--!strict`
  twins mirroring RetroMultiCiv's discipline. The FNV-1a 64 ports cleanly
  because the JS was written limb-first for exactly this.
- `luau/spine-check.luau` — lune runner recomputing every golden vector.
- `roblox/default.project.json` — Rojo mounts `luau/` → `ReplicatedStorage.Shared`.
- `test/fixtures/spine_golden.json` — pinned mix32 / seedSfc32 / sfc32 stream /
  FNV / spine state-hash vectors.
- `test/{prng,fixedmath,canonical,luau_twin}.test.js` — unit gates + a
  cross-language gate that runs the lune parity check (skips if lune absent).

**Gate:** `npm test` → 18/18 green, including byte-identical JS↔Luau parity
proven via `lune 0.10.5`.

**Next:** slice-003 road-data-loader → slice-004 single-car-physics, which
introduces the first real engine state and its first reducer hash fixture
(`checkpoint_1a`).

---

## marker-0002 — slice-003 road-data-loader (2026-07-31)

**Goal:** load and validate course geometry so later slices (physics, renderer)
have a graph of road segments to run on. Data loader only — no physics yet.

**Built:**
- `data/roads.json` — a minimal `sunset_coast` course (§8 schema): three linear
  segments (1→2→3→finish) with the checkpoint on segment 2 (checkpointTicks 600
  = 30 s), integer curve/hill profiles, per-segment traffic seeds and scenery.
- `shared/road_data.js` — pure, parse-at-edge loader (`loadCourseSet` takes
  already-parsed JSON so the fs read stays out of Luau-portable code). Validates
  integer-only fields, positive ids, referential integrity of `next`/`forkLeft`/
  `forkRight`/`startSegment`, and the fork-vs-linear exclusivity rule (a fork
  routes via both branches with `next = -1`; a linear segment routes via `next`).
  Exposes `getCourse`, `getSegment`, `nextSegment(cs, id, choice)` — forks honour
  FORK_LEFT/FORK_RIGHT and default LEFT deterministically when no choice is given.
- `test/road_data.test.js` — load/index, linear chaining, checkpoint placement,
  fork routing + default, and eight negative cases (dangling refs, malformed
  forks, floats in profiles, unknown startSegment).

**Gate:** `npm test` → 27/27 green. Luau twin of the loader is deferred to the
batched post-Milestone-1 pass.

**Next:** slice-004 single-car-physics — first real engine state + reducer.
