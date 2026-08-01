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

---

## marker-0008 — Luau engine twin (batched, post-M1) (2026-08-01)

**Goal:** the deferred full Luau port of the engine, proven byte-identical to JS
against the `checkpoint_1a` golden.

**Ported (§20 order):** `luau/{road_data,car_data,traffic_data}` loaders and
`luau/{state,car_physics,road_progress,traffic,copy_state,snapshot,reducer,
scenario}` — mirroring the JS engine. `canonical.luau` gained `writeI32LE`.

**Translation traps handled:** held flags are numbers → compare `~= 0` (Luau
0 is truthy); serde arrays are 1-indexed → `arr[(value % #arr) + 1]`; Luau
`continue`; snapshot byte layout field-identical.

**Gate:** `luau/checkpoint-1a-check.luau` runs the scenario through the Luau
engine and asserts every pinned hash + final hash + census. Matched JS on the
first run: `aede4f551034a311`. `test/luau_engine.test.js` runs it in `npm test`;
`test.sh` runs both Luau gates. `specs/08`. Rojo already mounts `luau/`.

**Gate:** `./test.sh` → 65/65 + spine parity + engine parity OK.

**Next:** Milestone 2 — node ws server room (slice-009), remote session seam
(slice-010).

---

## marker-0009 — slice-009 node-ws-room (2026-08-01)

**Goal:** a server-authoritative race room over http + `ws` (first Milestone 2
slice). First runtime dependency: `ws`.

**Built:**
- `server/protocol.js` — join/input/welcome/view/error + on-wire validation.
- `server/game_room.js` — `createRoom`: drop-in `addSeat`/`removeSeat` (cap
  `maxSeats` 8), queued per-seat input, `tick()` (drain inputs → advance_tick,
  sim stays the pure reducer), `viewFor` (self + minified ghosts + traffic +
  hash).
- `server/index.js` — `startServer` (exported for tests; `npm start` boots on
  PORT): node http static host for client/shared/engine/data + a 20 Hz room that
  broadcasts per-seat views.
- `test/game_room.test.js` (drop-in, self/ghost split, maxSeats, leave,
  deterministic replay) + `test/server_ws.test.js` (real ws join→input→view,
  malformed-input rejection). `specs/09`.

**Gate:** `./test.sh` → 71/71 + both Luau gates OK.

**Next:** slice-010 remote-session-seam (client remote session).

---

## marker-0010 — slice-010 remote-session-seam (2026-08-01)

**Goal:** one interchangeable client seam for offline (local) and online
(server-authoritative) play — completing Milestone 2.

**Built:**
- `client/session_remote.js` — `createRemoteSession`: connect/join, send held
  input at 20 Hz, track the latest `view`; `getState()` exposes `seats[0]=self`
  (+ ghosts/traffic), empty until the first view. Import-safe; WebSocket
  injectable for headless tests.
- `client/main.js` — `?mode=remote` joins the ws room; default stays local. The
  frame loop advances locally only in local mode, renders the server view in
  remote mode.
- `test/remote_session.test.js` — end-to-end headless: remote session (node ws)
  joins a real server room and tracks the moving view. Import gate covers
  `session_remote`. `specs/10`.

**Gate:** `./test.sh` → 73/73 + both Luau gates OK.

**MILESTONE 2 COMPLETE** (server room). **Next:** Milestone 3 — 8-player ghost
race (ghost filtering + finish ordering + server replay), plus client-side
prediction/reconciliation (§21.2).

---

## marker-0011 — slice-011 ghost-players (2026-08-01)

**Goal:** rivals as filtered ghosts + race standings (first Milestone 3 slice).

**Built:**
- `shared/collision.js` — pure integer collision geometry (`CAR_LENGTH 512`,
  `CAR_WIDTH 200`, `inCollisionWindow`, `overlapping`). Same-segment-only, so
  context is projection- and iteration-order-independent.
- `server/game_room.js` — `viewFor` sends filtered ghost state (§10 fields) +
  `collisionActive`; adds deterministic `standings` (finished-by-tick then
  progress proxy, tie-broken by seatId).
- `client/renderer_canvas.js` — `drawGhosts` (same-segment ahead, semi-transparent,
  outlines collisionActive rivals).
- `test/ghosts.test.js` + `specs/11`.

**No repin:** all changes are view-level; engine hash untouched, `checkpoint_1a`
and both Luau gates stay green.

**Gate:** `./test.sh` → 77/77 + both Luau gates OK.

**Next:** slice-012 same-segment-collision.

---

## marker-0012 — slice-012 same-segment-collision (2026-08-01)

**Goal:** arcade rival soft-bump for cars sharing a segment, gated per room,
twinned in Luau. Completes Milestone 3.

**Built:**
- `engine/collision.js` — `resolveRivalCollisions`: overlapping seats shed
  `BUMP_SLOW` and shove apart by `BUMP_PUSH`, emit `collision` events.
  Order-INDEPENDENT (deltas from pre-bump state, applied together;
  seatId tie-break).
- `engine/reducer.js` — runs collision as a cross-seat pass after the per-seat
  loop (equivalent to §25 step 10; keeps single-seat hashes stable), gated by
  `ctx.rivalCollision`.
- `engine/scenario.js` — multi-seat (`scenario.seats`), per-input `seatId`,
  `scenario.rivalCollision`; `collision` added to the census set.
- `server/game_room.js` — `createRoom({ rivalCollision })` threads the toggle.
- Luau twin: `luau/collision.luau` + reducer/scenario updates +
  `luau/collision-1a-check.luau` gate (matches JS `28f01c18c272da59`).
  `test.sh` runs three Luau gates.
- `test/fixtures/collision_1a.json` (2-seat golden) + `test/collision.test.js`.
  `specs/12`.

**No repin of checkpoint_1a:** single-seat behaviour and hashes unchanged
(verified `aede4f551034a311`).

**Gate:** `./test.sh` → 83/83 + spine + checkpoint + collision Luau parity OK.

**MILESTONE 3 COMPLETE.** **Next:** slice-013 replay-dump-load, then Milestone 4
(traffic collision + AI drivers + sim campaign), and client prediction (§21.2).

---

## marker-0013 — slice-013 replay-dump-load (2026-08-01)

**Goal:** dump a live room's play as a re-runnable scenario; loading it
reproduces the exact final hash.

**Built:** `server/game_room.js` records seats + input changes and `dumpReplay()`s
a scenario (with `maxSeats` + `runToMaxTicks`); `engine/scenario.js` honours both;
`engine/replay.js` `runReplay` = thin `runScenario` wrapper. `test/replay.test.js`.
`specs/13`. **Gotcha caught:** dropping `maxSeats` from the dump diverged the hash
(race.maxSeats is hashed) — every hashed field must survive the dump.

**Gate:** `./test.sh` → 86/86 + 3 Luau gates OK.

---

## marker-0014 — slice-014 ai-driver (2026-08-01)

**Goal:** a deterministic AI command source (§14).

**Built:** `engine/ai_driver.js` `chooseInput` — accel-always, HOLD-lane (dodge
traffic ahead / recover off-road); an earlier centre-seeking policy piled the
field up, so lane-holding is deliberate. `engine/state.js` `makeSeat`/
`createInitialState` gain optional per-seat `laneX` (default centre — goldens
unchanged); `engine/sim.js` `runAiRace`/`staggeredSeats`/`runCampaign`.
`test/ai_driver.test.js` pins a JS-only solo AI golden (finish 215,
`65793a01af08c340`). AI is a command source → intentionally NOT Luau-twinned.
`specs/14`.

**Gate:** `./test.sh` → 90/90 + 3 Luau gates OK.

---

## marker-0015 — slice-015 sim-campaign (2026-08-01)

**Goal:** the AI-only "do systems fire?" gate.

**Built:** `debugging/sim_campaign.mjs` (5 pinned seeds, AI field, event census +
`systems fired` summary) + `test/sim_campaign.test.js`. `specs/15`.

**Finding (recorded):** the race seed is currently **inert** — traffic is
segment-seeded (constant) and the AI deterministic, so all seeds produce an
identical race. Pinned as a tripwire test; fix direction (race-seeded traffic)
noted for a balance slice. 6-car run: finish/checkpoint/collision fire, timeout
does not (short course).

**Gate:** `./test.sh` → 93/93 + 3 Luau gates OK.

**Next:** traffic collision (repins `checkpoint_1a` both languages), sweep
battery + fairness tools (§16), client prediction/reconciliation (§21.2).

---

## marker-0016 — traffic collision (2026-08-01)

**Goal:** always-on player/AI vs traffic crash — traffic becomes a real hazard.
Completes Milestone 4's collision picture.

**Built:**
- `engine/collision.js` `resolveTrafficCollisions` (step 9): overlapping a
  traffic car cuts speed to 1/3 and emits a `collision {kind:"traffic"}`. No new
  state field, no pile-up. Reducer runs it (always) before the gated rival pass.
- Luau twin: `luau/collision.luau` + `luau/reducer.luau` updated.
- `test/collision.test.js` — speed-cut + event, lane/segment misses ignored.

**REPINS (conscious):**
- `physics_1a` + `checkpoint_1a` (accel-only, never steers → crashes ~9×):
  finish moves 215 → **404**; t10/t100 unchanged (no crash pre-123);
  checkpoint_1a `finalHash 0e884b18cd3c2126`, maxTicks → 500.
- AI solo golden: AI dodges (4 crashes), finishes **307**, `518f6d9c4f188ae3`.
- `collision_1a` UNCHANGED (those cars never reach traffic).
All verified in Luau (both engine gates green). `specs/16`.

**Gate:** `./test.sh` → 95/95 + 3 Luau gates OK.

**MILESTONE 4 COMPLETE.** **Next:** sweep battery + fairness tools (§16 brief:
mirror / car-swap / traffic-swap / seat-order), client prediction (§21.2).

---

## marker-0017 — race-seeded traffic (2026-08-01)

**Goal:** resolve the sim-campaign finding — make the race seed matter — so
balance sweeps have something to sweep.

**Built:** `engine/traffic.js` + `luau/traffic.luau` seed `spawnSegmentTraffic`
with `(segment.trafficSeed + state.seed)` instead of the segment seed alone.
Still segment-stable within a race; now race-varying.

**REPINS (conscious):** all traffic-bearing goldens — `physics_1a`/`checkpoint_1a`
(accel-only finish 404 → **266**; `checkpoint_1a 18d3231cfe065ab3`), `collision_1a`
(hashes changed, census same, `de2c16e61a6abd81`), AI golden (finish **339**,
`fef5f12dc746ecba`). Luau gates re-verified. The `sim_campaign` "seed inert"
tripwire flipped to "race seed varies the outcome." `specs/17`.

**Gate:** `./test.sh` → 95/95 + 3 Luau gates OK.

**Next:** sweep battery + fairness tools (marker-0018).

---

## marker-0018 — sweep battery & fairness instruments (2026-08-01)

**Goal:** balance tooling (§15.5, §16), unblocked by race-seeded traffic.

**Built:**
- `engine/sim.js` `runAiRace` census enriched: winnerSeat/Car, avgFinishTicks,
  maxSpeed, collisions split traffic/rival.
- `tools/sim_sweep.mjs` — CSV over N seeds (12 columns).
- `engine/fairness.js` + `debugging/fairness.mjs` — `seatOrderFairness`
  (win share of two identical mirror-lane cars) and `carSwap` (car strength via
  average finish tick). `data/cars.json` gained car 2 (`blue_bolt`).
- `test/fairness.test.js`.

**Findings (recorded):**
- **Seat/left-lane skew** — seat 1 (left start lane) wins 29/40. Flagged for a
  fairness pass; the test asserts non-monopoly only.
- **Roster** — blue_bolt ~245 avg finish vs red_sprint ~258 (mild edge).

**No repin:** adding car 2 doesn't touch goldens (they use car 1);
sim/fairness are read-only over the engine.

**Gate:** `./test.sh` → 99/99 + 3 Luau gates OK.

**Next:** the seat/lane-skew investigation, `analyze_sweep.py` for large-N,
client prediction/reconciliation (§21.2), and Milestone 5 content (forks +
multi-checkpoint courses → route-mirror fairness, music, mobile).

---

## marker-0019 — client/server import boundary (playtest bugfix) (2026-08-01)

**Reported:** `npm start` → localhost showed a blank square;
`GET /server/protocol.js` failed with `NS_ERROR_CORRUPTED_CONTENT` / disallowed
MIME.

**Cause:** `client/session_remote.js` imported `../server/protocol.js`, but the
static host only serves `client/shared/engine/data` — the browser 404'd it with
an empty MIME, blocking the whole (eager, static) module graph, so `boot()` never
ran.

**Fix:** moved the protocol (a shared contract, pure) to `shared/protocol.js`;
deleted `server/protocol.js`; updated server + client + ws-test imports. The
client no longer imports from `server/`.

**Self-tests added (`test/serve_static.test.js`):** scan every client import and
fail on any that resolves outside a served dir; and start the real server and
`fetch` client modules over HTTP asserting 200 + JS MIME — reproducing the exact
failure. `specs/19`.

**Gate:** `./test.sh` → 101/101 + 3 Luau gates OK.

**Not verified:** on-screen visuals still need a native browser (§17); this fix
only restores module loading + `boot()`.

---

## marker-0020 — projection flip fix (road in the sky) (2026-08-01)

**Reported:** playtest screenshot showed the road as a downward-V in the sky
(upper half), sunset in the lower half — vertically flipped.

**Cause:** `client/projection.js` used `worldY - -CAMERA.height` (camera below
road), so nearer road strips projected to negative y (top/sky).

**Fix:** camera sits ABOVE the road → camera-relative Y = `worldY - CAMERA.height`
(negative), landing the road below the horizon (`y > h/2`), nearer strips lower.
Matches the standard pseudo-3D projection (Jake Gordon's JS Racer — the renderer
reference; cited, not vendored, for licensing).

**Self-test:** `test/projection.test.js` asserts road projects at `y >= h/2` and
nearer < lower — the invariant the flip broke. `specs/20`.

**Gate:** `./test.sh` → 102/102 + 3 Luau gates OK. Re-screenshot to confirm the
road now sits below the horizon; camera magnitudes remain first-pass (§17).

---

## marker-0021 — branching forks (Milestone 5) (2026-08-01)

**Goal:** deterministic branching routes — the OutRun fork. User confirmed the
renderer works (road below horizon, car steers) before this.

**Built:**
- `data/roads.json` — course 2 `canyon_split` (10 → 11 fork → {12 L | 13 R} →
  14 → finish); course 1 unchanged.
- `CMD_FORK_CHOICE` command + seat `forkChoice` field; `advanceRoad` routes via
  the pending choice and consumes it at the fork (default left).
- `engine/scenario.js` `forkChoices[]` support.
- Luau twin: state/snapshot/road_progress/reducer/scenario + new
  `luau/fork-1a-check.luau` (4th Luau gate, `d8358de79eb6029f`).
- `test/forks.test.js` + course-2 topology test; `specs/21`.

**REPINS (conscious, mechanical — forkChoice joined the hashed seat state,
behaviour unchanged):** `checkpoint_1a f817fa6fe43aaf43`, `physics_1a`,
`collision_1a 0e231a34e0f33f71`, AI golden `c826f4e86f0f04fa`, roads content-hash
`7d0880b9b6ede6b3`. New `fork_1a` golden (right-choice, finish 227).

**Gate:** `./test.sh` → 108/108 + 4 Luau gates OK.

**Next:** client fork UI + course select, route-mirror fairness (§16.1), and the
rest of Milestone 5 (multi-checkpoint content, music, mobile, asset pipeline).

---

## marker-0022 — client fork UI & course select (2026-08-01)

**Goal:** drive the fork in-browser (local + remote) and pick the course. No
engine change → no repin.

**Built:**
- `client/input.js` — edge-triggered Q/E fork queue (`readForkChoice`).
- `session_local`/`session_remote` — `setForkChoice` (local applies the reducer
  command; remote sends a protocol message); `main.js` pumps it + `?course=N`.
- `client/renderer_canvas.js` — fork prompt when the current/next segment forks.
- `shared/protocol.js` `C2S.FORK`; `server/index.js` + `game_room.setForkChoice`
  (applies + records → replays carry `forkChoices`).
- `test/client_fork.test.js`; RUNNING.md controls. `specs/22`.

**Gate:** `./test.sh` → 112/112 + 4 Luau gates OK.

**Next:** curve physics (centrifugal) — makes curves push the car and turns
route-mirror fairness into a real instrument.
