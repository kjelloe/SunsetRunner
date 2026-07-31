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

---

## marker-0003 — slice-004 single-car-physics (2026-07-31)

**Goal:** first real engine state and the pure reducer that drives it —
accelerate, brake, steer, advance down the road graph, finish — with a pinned
snapshot-hash fixture.

**Built:**
- `data/cars.json` + `shared/car_data.js` — one car (`red_sprint`, §13 stats),
  parse-at-edge loader/validator mirroring road_data.
- `engine/state.js` — array-shaped engine state (race + seats) + initial-state
  factory; content threaded as context, not stored in hashed state.
- `engine/commands.js` — `input` (held controls) and `advance_tick`, with
  integer validation.
- `engine/car_physics.js` — longitudinal (brake>accel>coast-drag, off-road
  drag, clamp) and lateral (speed-tapered steer authority, clamp).
- `engine/road_progress.js` — `roadZ += speed`, linear segment crossing, finish
  at `next = -1`.
- `engine/copy_state.js` — deep clone keeping the reducer pure.
- `engine/reducer.js` — `apply(state, command, ctx)` in pinned tick order.
- `engine/snapshot.js` — `hashSnapshot()` over version+tick+race+seats. Kept
  SEPARATE from the spine `shared/statehash.js` so the spine hash and its
  shipped Luau twin stay stable while the Luau engine twin is deferred. This is
  the module the twin mirrors post-M1.
- `test/{car_data,physics}.test.js` + `test/fixtures/physics_1a.json` — physics
  units, reducer purity, invalid-command rejection, and a golden accel-only run
  (hashes at t10/t100, finish at t215, terminal hash at t400).
- `specs/03-car-physics-and-engine-state.md`.

**Gate:** `./test.sh` → 41/41 + Luau spine parity OK (spine hash untouched).

**Next:** slice-005 canvas-road-renderer (first client) or slice-006
checkpoint-timer — the timer completes the solo-run gameplay loop.

---

## marker-0004 — slice-005 canvas-road-renderer (2026-07-31)

**Goal:** first client — a Canvas 2D pseudo-3D road, player car, speed HUD,
keyboard driving, and a local session driving the real reducer.

**Built (`client/`):** `projection.js` (pure pseudo-3D projection — floats live
CLIENT-side, out of the integer/Luau core), `road_renderer.js` (`forwardStrips`
pure geometry walk + `drawRoad`), `renderer_canvas.js`, `hud.js`, `input.js`
(keyboard → integer frame), `session_local.js` (setInput/tick/getState seam),
`main.js` (20 Hz accumulator + rAF render, DOM-guarded boot), `index.html`.
Plus `specs/04`, `RUNNING.md`.

**Tests:** `test/projection.test.js` (projection monotonicity/centre-x,
forwardStrips course walk + finish + curve accumulation) and
`test/client_imports.test.js` (headless import gate, readInput integers, local
session determinism).

**Verified vs not:** engine-driving + pure helpers are gated headlessly. Visual
feel/camera tuning is NOT verified — needs a native browser (brief §17);
Playwright is still deferred. `projection.js` magnitudes are a first pass.

**Gate:** `./test.sh` → 50/50 + Luau spine parity OK.

**Next:** slice-006 checkpoint-timer — extends engine state (repins the physics
golden) and closes the solo gameplay loop.

---

## marker-0005 — slice-006 checkpoint-timer (2026-07-31)

**Goal:** classic arcade checkpoint timer — start budget, checkpoint top-up,
timeout at zero — closing the solo gameplay loop.

**Built:**
- `data/checkpoints.json` (`startTimeTicks 1500`) + `shared/checkpoint_data.js`.
- `engine/state.js` — seat gains `timerTicks` + `timedOut`; `createInitialState`
  takes `startTimeTicks` (fallback `DEFAULT_START_TIME_TICKS`).
- `engine/road_progress.js` — `advanceRoad` now returns the `entered` segment
  ids so the reducer can award checkpoint bonuses.
- `engine/reducer.js` — step 7 checkpoints (bonus + `checkpoint` event on
  entering a segment with `checkpointTicks > 0`), step 11 timer bleed +
  `timeout` (zero speed, `timedOut = 1`); finish this tick skips timer.
- `engine/snapshot.js` — serializes `timerTicks` + `timedOut`.
- `client/hud.js` timer readout (red < 5 s, `TIME UP` banner);
  `client/main.js` + `session_local.js` thread the start time.
- `test/checkpoint_data.test.js` + physics golden extended (checkpoint tick 119
  +600, timeout scenario). `specs/05`.

**REPIN:** `test/fixtures/physics_1a.json` snapshot hashes were repinned because
`timerTicks`/`timedOut` joined the hashed seat state (conscious act). Behaviour
unchanged — finish still tick 215.

**Gate:** `./test.sh` → 54/54 + Luau spine parity OK (spine hash untouched; the
engine-state hash `engine/snapshot.js` is the one that grew — twin post-M1).

**Next:** Milestone 1 is functionally complete (solo checkpoint run). Remaining
M1 polish: slice-007 traffic-spawn, slice-008 local-race-loop (promote the
golden to `checkpoint_1a`). Then the batched Luau engine twin, then Milestone 2
(server room).

---

## marker-0006 — slice-007 traffic-spawn (2026-07-31)

**Goal:** deterministic, segment-seeded traffic — spawn + movement (no collision
yet).

**Built:**
- `data/traffic.json` (density/lanes/kinds) + `shared/traffic_data.js`.
- `engine/traffic.js` — `spawnSegmentTraffic` (seeded ONLY from
  `segment.trafficSeed`, fixed roll order, spawn-once guard) and
  `advanceTraffic` (move + despawn off-segment-end). Order-independent of seats
  (§24, gotchas #12/#15).
- Engine state gains `traffic[] / spawnedSegments[] / nextTrafficId`; wired into
  `state.js` (start-segment spawn), `copy_state.js`, `snapshot.js`, and the
  reducer (step 8a spawn on entered segments, 8b advance).
- Client: `drawTraffic` (approx, same-segment ahead) + config threaded through
  `main.js`/`session_local.js`.
- `test/traffic.test.js` + `specs/06`.

**REPIN:** `physics_1a` snapshot hashes repinned (traffic joined the hashed
state). Accel run now starts with 4 cars; finish still tick 215, checkpoint tick
119, timeout tick 30 — all unchanged. Verified reproducible across two runs.

**Gate:** `./test.sh` → 60/60 + Luau spine parity OK.

**Next:** slice-008 local-race-loop — formalize the scenario replay + promote the
golden to `checkpoint_1a` with a repin tool.

---

## marker-0007 — slice-008 local-race-loop (2026-07-31)

**Goal:** formalize the headless race loop as a deterministic scenario replay
and pin the Milestone 1 golden `checkpoint_1a`.

**Built:**
- `engine/scenario.js` — `runScenario(scenario, ctx)`: scheduled input changes
  (held between ticks) drive the reducer to completion; returns state, pinned
  snapshot hashes, an ordered event census, and the final hash. Stops when all
  seats finish/timeout.
- `test/fixtures/checkpoint_1a.json` — seed 12345 accel run: hashes at 10/100/215,
  `finalHash aede4f551034a311`, `finishTick 215`, census `[checkpoint@119,
  finish@215]`. Hashes at 10/100 match `physics_1a` (consistent by construction).
- `tools/repin_checkpoint_1a.mjs` — conscious repin (requires a reason, prints
  the census before writing).
- `debugging/replay.mjs` — human race report (replay as bug report).
- `test/checkpoint_1a.test.js` — pinned hashes, census drift tripwire,
  two-run byte-identity, loop termination. `specs/07`.

**Gate:** `./test.sh` → 64/64 + Luau spine parity OK.

**MILESTONE 1 COMPLETE** (solo checkpoint run). **Next:** the batched Luau engine
twin (port order §20, cross-checked against `checkpoint_1a` as the JS↔Luau
contract), then Milestone 2 (node ws server room).
