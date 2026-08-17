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

---

## marker-0023 — curve physics & route-mirror fairness (2026-08-01)

**Goal:** make curves push the car (they were renderer-only), then a
mirror-fairness instrument that proves the push is symmetric.

**Built:**
- `engine/road_progress.js` `curveAt`; `engine/car_physics.js` `applyCurvePush`
  (step 5b, outward `curve*speed/4096`, **truncDivI32** so mirrors are fair);
  reducer calls it after steering. Luau-twinned.
- `data/roads.json` course 3 `mirror_valley` (equal-length mirrored branches).
- `engine/fairness.js` `mirrorFairness` + `debugging/fairness.mjs` line +
  `test/fairness.test.js` case. Measured **FAIR**: left/right finish 183=183,
  drift −18=−(+18).

**REPINS (conscious):** `physics_1a`/`checkpoint_1a` (`cb23ee95e6f36118`, finish
266), `fork_1a` finalHash (`d09dbb310569a237`), AI golden (finish 343,
`6a4803fb66324a7b`), roads content-hash `7844aea058de58fc`. `collision_1a`
unchanged (flat lead-in). 4 Luau gates re-verified.

**Gate:** `./test.sh` → 113/113 + 4 Luau gates OK.

**Next:** traffic-swap fairness (§16.3), seat/lane-skew fix, and the rest of
Milestone 5 (music, mobile touch, asset pipeline).

---

## marker-0024 — same-tick finish-tie fairness fix (2026-08-01)

**Goal:** diagnose + fix the seat/left-lane skew (specs/18).

**Diagnosis:** with traffic off, two identical cars finish the SAME tick every
seed (215/215); `runAiRace` awarded the winner to `finishes[0]` (seat-array
order) → seat 1 won every tie (§24 gap).

**Fix (no engine hash change):**
- `engine/sim.js` — earliest-tick winner; a shared minimum is `tie` (winnerSeat
  -1), awarded to nobody.
- `engine/fairness.js` `seatOrderFairness` → `{ decisive, ties, wins }`.
- `engine/ai_driver.js` — symmetric dodge (right→left, left→right, ahead→centre);
  no-op on goldens, removes latent AI bias.

**Residual (recorded):** ~26/12 decisive lean remains — course-1 geometry +
traffic on fixed lanes + AI, NOT engine unfairness (mirror-fairness proves the
engine symmetric). Tests assert non-monopoly only. `specs/24`.

**Gate:** `./test.sh` → 114/114 + 4 Luau gates OK. AI golden unchanged
(`6a4803fb66324a7b`).

**Next:** traffic-swap fairness (§16.3), rest of Milestone 5 (music, mobile,
asset pipeline).

---

## marker-0025 — slice-017 mobile touch controls (2026-08-01)

**Goal:** playable on a phone. Client-only, no repin.

**Built:** `client/touch_controls.js` — canvas-fraction buttons (◄►/BRK/GAS/QE),
held steer/accel/brake via active pointers + edge-triggered fork; `drawTouchControls`
overlay. `main.js` merges keyboard+touch each frame; overlay shows on touch
devices or `?touch=1`. `test/touch_controls.test.js` (synthetic pointer events:
hold/release, multi-touch, edge-fork, out-of-bounds). `specs/25`, RUNNING.md.

**Gate:** `./test.sh` → 118/118 + 4 Luau gates OK.

**Next:** slice-018 asset-strip pipeline, music, traffic-swap fairness (§16.3).

---

## marker-0026 — slice-018 asset / sprite pipeline (2026-08-01)

**Goal:** procedural sprites via a pinned manifest; renderer references sprite
IDs, not hand-coords (§18). The last numbered slice.

**Built:**
- `tools/build_assets.mjs` → `data/assets.json` (packed catalog: player_car,
  traffic sedan/truck, palm, sign; strip 264x96). `npm run assets`.
- `client/sprite_renderer.js` `drawSprite` (by kind); `renderer_canvas` draws
  player + traffic + roadside scenery from the manifest (rect fallback);
  `main.js` fetches `data/assets.json`.
- `tools/render_asset_strip.mjs` — dependency-free P6 PPM of the strip
  (`debugging/logs/`, gitignored). `npm run strip`.
- `test/assets.test.js` — strip width (264) + manifest hash (09f1ccd63280f8c8)
  pinned (§18/gotcha #16), build determinism vs shipped file, non-overlap
  packing, referenced-sprite existence, drawSprite kind dispatch. `specs/26`.

**Gate:** `./test.sh` → 123/123 + 4 Luau gates OK. Client-only, no repin.

**MILESTONE 5 mostly complete** (forks, curve physics, fork UI, touch, assets).
Remaining feel: music select, native visual/perf tuning (§17). Open: traffic-swap
fairness (§16.3), client prediction (§21.2).

---

## marker-0027 — traffic-swap fairness (§16.3) (2026-08-01)

**Goal:** does traffic accidentally favour a fork branch? Completes the §16
fairness trio.

**Built:** `engine/fairness.js` `trafficSwapFairness` — walks the course to its
fork, measures the left−right finish delta with traffic, swaps the two branches'
`trafficSeed`s, re-measures; `residual = deltaNormal + deltaSwapped` (≈0 ⇒ all
difference is traffic ⇒ geometry fair). `test/fairness.test.js` +
`debugging/fairness.mjs` line.

**Findings:** mirror_valley residual **0** (traffic-only, geometry fair —
`11.9 → −11.9`); canyon_split residual **44.8** (geometry bias survives swap, its
branches are 500 vs 400 strips). Instrument cleanly separates luck from geometry.

**Gate:** `./test.sh` → 125/125 + 4 Luau gates. Measurement only, no repin. §16
fairness trio (mirror/car-swap/traffic-swap) + tie fix all in.

**Next:** client prediction/reconciliation (§21.2); music; native visual/perf.

---

## marker-0028 — client-side prediction & reconciliation (§21.2) (2026-08-01)

**Goal:** instant input in remote play; server stays authoritative.

**Built:**
- `client/prediction.js` `createPredictor` — runs the real reducer on a
  single-seat traffic-free state; `predict(seq)` buffers + advances, `reconcile
  (serverSelf, ackSeq)` snaps to authoritative + replays unacked inputs.
- Wire: `input` carries an optional `seq`; room echoes `view.ackSeq` per seat.
  Reducer untouched (seq is transport only — no golden change).
- `session_remote.js` builds a predictor on welcome (course/car data from
  main.js), predicts each send, reconciles each view; `getState().seats[0]` is
  the predicted self (instant) with authoritative ghosts/traffic. Raw-view
  fallback without data.
- `test/prediction.test.js` — EXACT vs no-surprise room, reconcile drop+replay,
  stale-ack, live-server integration. `specs/28`.

**Gate:** `./test.sh` → 129/129 + 4 Luau gates OK. No repin.

**Next:** reconcile smoothing (visual), music, native visual/perf tuning.

---

## marker-0029 — mobile touch compatibility fix + self-tests (2026-08-01)

**Reported:** "look into mobile controls and compatibility."

**Bug found:** `installTouch` mapped taps as `offsetX / bufferWidth` (960),
correct only at native size. On a phone the canvas is CSS-scaled to fit, so every
touch hit the wrong button (gotcha #9).

**Fixes (client-only, no repin):**
- `touch_controls.js` `eventFraction(canvas, e)` maps via the bounding rect +
  clientX/Y (scale/offset independent; offset fallback kept); `installTouch(canvas)`.
- `index.html` responsive canvas (`min(100vw,177.78vh)`, `aspect-ratio 16/9`),
  `touch-action: none`, `user-select: none`, no pinch-zoom.

**Self-tests added (`test/touch_controls.test.js`, now 8):** eventFraction rect +
fallback, correct hit-testing on a CSS-scaled + offset canvas (the exact bug),
multi-touch on a scaled canvas, button-layout sanity (unique/in-bounds/no-overlap).
`specs/25` updated; PLAYTEST.md touch items sharpened.

**Gate:** `./test.sh` → 133/133 + 4 Luau gates OK.

**Still native-only:** on-device ergonomics + high-DPR crispness (960 buffer is
CSS-upscaled; a DPR buffer resize is later polish).

---

## marker-0030 — sense of speed + graphics pass (2026-08-02)

**From playtest:** "feels like standing still", "graphics very blocky", WASD.

**Root cause (the big one):** `forwardStrips` used `worldZ = (k+1)*ROAD_UNIT`,
fixed per screen row regardless of the car's roadZ — the road never scrolled.

**Fixes (client-only, no repin):**
- `forwardStrips`: `worldZ = k*ROAD_UNIT + (ROAD_UNIT - roadZ%ROAD_UNIT)` (nearest
  strip slides toward camera) + a scrolling `worldStrip` index for band/rumble/
  dash/scenery phase. Proven by new projection.test scroll assertions.
- road: scrolling tarmac + red/white rumble strips + dashed centre line; scenery
  now scrolls (worldStrip) and is denser (palms+signs both sides); horizon haze.
- `sprite_renderer.js`: shaped/shaded cars (gradient body, cabin, windshield,
  wheels, tail-lights, shadow), layered palms, gradient signs; removed
  `image-rendering: pixelated`.
- `input.js`: preventDefault driving keys (arrows/WASD/Space) — no page scroll.
  WASD + arrows both drive (always did; static road hid it).

**Gate:** `./test.sh` → 135/135 + 4 Luau gates OK. `specs/29`.

**Next (same playtest):** finish celebration (confetti/fireworks), mobile arrow-pad.

---

## marker-0031 — finish celebration + mobile arrow pad (2026-08-02)

**From playtest:** finish needs confetti/fireworks; mobile needs arrows on screen.

**Built (client-only, no repin):**
- `client/celebration.js` — confetti (180 rotating pieces) + fireworks (radial
  spark bursts, ~1/s) + gradient FINISH! banner; triggered on finishTicks>=0.
  main.js triggers/updates/draws each frame. Cosmetic (Math.random OK).
- `client/touch_controls.js` — on-screen ARROW pad: ◄►(steer) ▲▼(accel/brake)
  ↰↱(fork), replacing GAS/BRK text; zones non-overlapping (layout test),
  rect-based hit-testing (marker-0029).
- `test/celebration.test.js` + import gate; specs/30, PLAYTEST.md updated.

**Gate:** `./test.sh` → 139/139 + 4 Luau gates OK.

**Playtest items addressed:** speed (30-static-road fix), gfx polish, WASD+arrows,
finish splash, mobile arrows. Remaining: curve/camera feel + DPR (native-only), music.

---

## marker-0032 — driving feel: crash stun + cornering (2026-08-02)

**From playtest:** speed drops in corners, does steering matter, brake before turns.

**Diagnosis (tick trace):** the drops were TRAFFIC CRASHES, firing every tick you
overlapped a car (1760->800->274->98 on ticks 113/114/115); corners were cosmetic.

**Fixes (engine, repin):**
- crash stun/immunity: hitting traffic sets seat.crashedTicks=30 (immune while
  counting down) -> one crash per encounter, recoverable (accel-only 9->2 crashes).
- cornering: CURVE_PUSH_DEN 4096->320 (truncDiv-symmetric) + car steer 18/9->22/14;
  sim-tuned so flat-out tips off-road in the sharp curve (peak ~517>512), braking
  stays on (0 off ticks), steering holds the line -> brake-before-turn + steering
  both matter.
- Luau twin updated (crashedTicks + DEN). mirrorFairness still exact (183=183,
  -396/396). Two fairness tests updated for the new physics (same-lane tie;
  traffic-swap relative residual). specs/31 (+27 note).

**REPINS:** physics_1a, checkpoint_1a 815e8a04c44fc59a (finish 279), collision_1a
ea720799d79d2321, fork_1a 24bb509ea5326409 (finish 199), AI 1d6b97a6d0cda2d2
(finish 238). 4 Luau gates re-verified.

**Gate:** `./test.sh` -> 138/138 + 4 Luau gates OK.

---

## marker-0033 — lateral render model + sprite-scale fix (2026-08-02)

**From playtest:** no traffic/scenery visible; car drift barely moves (1.5 car widths).

**Bug 1:** with assets loaded, traffic/scenery sprites were scaled by raw
perspective scale (~0.0003) -> sub-pixel -> invisible (rect fallback used
projected width, so it showed before sprites landed). Fix: spriteScale sizes to a
fraction of the projected road half-width.

**Bug 2:** car used a tiny fixed lateral map (~107px at edge) and camX=laneX (road
followed and cancelled motion); traffic used different units. Fix: one lateral
model `onRoad` (lane fraction of road half-width -> laneX=ROAD_HALF_WIDTH is the
road edge; player + traffic share coords), camera partial-follow CAM_FOLLOW 0.4.

test/projection.test.js onRoad case (centre/edge/narrowing, real width). specs/32.
Client-only, no repin. Gate: ./test.sh -> 139/139 + 4 Luau gates OK.

---

## marker-0034 — drop-in / reconnect multiplayer (2026-08-02)

**From:** the Pitfall: Drop-Zone write-up (connection != presence).

**Built (server bookkeeping, NOT hashed state -> no repin):**
- server/game_room.js: presence map (seatId -> {token, disconnectedTick}),
  markDisconnected, reclaim (idempotent + supersede), tick-based grace sweep
  (graceTicks default 900); randomUUID tokens.
- server/index.js: hello on connect; welcome carries token; reclaim handler
  (supersede old socket, code 4000); close -> markDisconnected (not free).
- shared/protocol.js: C2S.RECLAIM, S2C.HELLO/RECLAIM_FAILED, welcome token.
- client/session_remote.js: persist token (localStorage, injectable), reclaim on
  open, relentless reconnect (backoff 1s x1.7 cap 5s) + reconnect-on-visible,
  reclaim_failed -> clear token + onReclaimFailed + fresh join (never strand).
- test/reconnect.test.js: room grace unit + ws (drop/reclaim, grace expiry,
  supersede) + session_remote persisted-token reclaim. specs/33.

**Gate:** `./test.sh` -> 145/145 + 4 Luau gates OK.

**Deferred:** server-restart persistence (spec #4), wake lock, browser strand test (#7).

---

## marker-0035 — scenery/traffic follow the road curve (2026-08-02)

**From playtest:** trees and traffic don't follow the curves in the road.

**Cause:** onRoad placed entities relative to the STRAIGHT centreline (worldX=0),
while drawRoad bends each strip by its accumulated curveX -> road curved,
entities stayed in a straight column.

**Fix:** onRoad(view, camX, dz, laneX, curveX, hillY) projects relative to the
CURVED road centre (+ hill) at that depth; render() builds the strip list once and
`sampleStrip(strips, dz)` reads the curveX/hillY at each entity's distance, so
traffic/scenery/ghosts ride the bends and rises. test/projection.test.js curve case.

Client-only, no repin. Gate: ./test.sh -> 146/146 + 4 Luau gates OK.

---

## marker-0036 — hills + a fork on the default course (2026-08-02)

**From:** "make hills and the first fork".

**Hills (renderer-only):** hillProfile is direct elevation; HILL_SCALE 40->180 so
crests/dips read. Added hills to all 3 courses. Hills don't touch engine hashes
(fork_1a + mirror/traffic-swap fairness byte-identical) — only the content pin.

**First fork (course 1):** sunset_coast restructured 1 -> 2(cp) -> 3(fork) ->
{4 left | 5 right} -> 6 -> finish, hills throughout, bonus checkpoint on the right
branch. Default course now hits a fork in normal play.

**REPINS:** content a483515d79677564; physics_1a; checkpoint_1a 96c7d18179ba5b92
(default-left finish 297, cp@108); collision_1a d2f7696101148e38; AI
336dc614cd69a85a (297). fork_1a UNCHANGED. road_data.test updated (16 segments,
new 1->2->3-fork topology, 1800-strip walk). 4 Luau gates re-verified.

Gate: ./test.sh -> 146/146 + 4 Luau gates OK. specs/34.

---

## marker-0037 — server-restart persistence (2026-08-02)

**From:** the Pitfall write-up's #1-priority gap (deploys restart the process ->
the token is useless if the server forgot the game).

**Built (server bookkeeping, NOT hashed -> no repin):**
- game_room: serialize() (engine state + presence/tokens + inputs + replay log);
  createRoom({restore}) rebuilds verbatim (deterministic hash), restored seats get
  a FRESH grace clock.
- server/session_store.js: saveSession/loadSession (JSON + savedAt), best-effort,
  rejects files older than the grace window.
- server/index.js: opt-in via statePath; boot-restore, autosave 5s, save on
  close(), SIGTERM/SIGINT -> close() (entrypoint only). Default .state/session.json
  (gitignored).
- test/persistence.test.js: serialize/restore hash-identical + tokens; stale
  rejection; DEPLOY HANDOFF (join->play->kill->reboot->reclaim same seat, #4).

Gate: ./test.sh -> 150/150 + 4 Luau gates OK. specs/35.
Deferred: wake lock, browser strand test (#7), reconnect overlay.

---

## marker-0038 — mobile polish: high-DPR canvas + wake lock (2026-08-02)

Client-only, no repin.
- client/viewport.js computeBufferSize: buffer = displayed CSS size × DPR, 16:9,
  floor 320 / cap 1920 (crisp retina, no giant frames). main.js fit() on boot +
  resize + orientationchange; projection scales via view.w/h; touch unaffected
  (rect-based).
- client/wakelock.js installWakeLock: request screen lock, re-request on visible +
  first gesture, best-effort no-op when unsupported; nav/doc injectable.
- test/viewport.test.js (DPR/16:9/cap/floor + wake-lock request/re-request/no-op)
  + import gate; specs/36.

Gate: ./test.sh -> 154/154 + 4 Luau gates OK.

---

## marker-0039 — reconnect UI (connection banner) (2026-08-02)

Client-only, no repin. Surfaces the reconnect netcode.
- session_remote: status state machine (idle->connecting->live; live->reconnecting
  on drop; ->run_ended on refused reclaim) + onStatus callback + status getter.
- client/connection_banner.js: bannerText(status) + drawConnectionBanner (pulsing
  centre banner); main.js draws it each frame in remote mode.
- test/connection_banner.test.js (text mapping, draw gating, connecting->live on
  a real server) + import gate; specs/37.

Gate: ./test.sh -> 157/157 + 4 Luau gates OK.

---

## marker-0040 — car roster + balance sweep (2026-08-02)

Content + backend, no repin (car 1, the reference car every golden races, is
untouched; only cars 2-4 changed).
- data/cars.json: roster grown 2 -> 4 (green_machine high-top-speed/low-accel
  glass cannon; gold_glider nimble all-rounder), then tuned via the sweep to all
  four cars winning 18-32% across courses 1-3 (no imbalance flag).
- engine/sim.js rosterSeats(n, carIds): staggered lanes but cycles the whole
  roster, so winnerCar actually varies.
- tools/sim_sweep.mjs: races the full roster, rotating car->lane per race so a
  lane edge can't masquerade as a car edge; takes an optional courseId arg.
- tools/analyze_sweep.py: aggregates the CSV into per-car win share + flags a
  car above fair-share x1.5 or a course that mostly times out. Roster size =
  max car id (a never-winning car can't shrink the denominator).
- Finding: in AI fields thick with rival collisions, acceleration beats top
  speed — the first draft had blue_bolt at 48% and green_machine at 13%.
- test/balance_sweep.test.js (roster distinct, rosterSeats cycle+symmetry,
  varied winners, analyze_sweep flag math; py test skips if python3 absent).

Gate: ./test.sh -> 161/161 + 4 Luau gates OK.

---

## marker-0041 — car-select UI (2026-08-03)

Client-only, no repin. Makes the roster playable; the carId path already existed.
- client/car_select.js: carChoiceFromParams (?car=N skips overlay), createCarSelect
  (wrapping cursor + handle/confirm), drawCarSelect (name + stat bars),
  carSelectTouchZone (tap-to-choose).
- client/input.js readMenuNav(): edge-triggered left/right/confirm; frame loop
  drains it every frame (no leak) but only the select phase acts.
- client/main.js: two-phase boot (select -> race); session created only once a
  car is chosen so JOIN carries the choice; pointerup tap wiring.
- test/car_select.test.js + import gate; specs/39.

Gate: ./test.sh -> 168/168 + 4 Luau gates OK.

---

## marker-0042 — procedural audio (2026-08-03)

Client-only, no repin. Synthesised WebAudio (no asset files); AudioContext
injectable for headless tests.
- client/audio.js createAudio: resume() (gesture-gated context + engine osc +
  chiptune loop), setSpeed -> engine pitch 60+frac*220Hz, event(kind) one-shot
  SFX (checkpoint/crash/nearmiss/finish), setEnabled/stopMusic mute path.
- client/main.js: armed on first keydown/pointerdown; per-frame setSpeed; SFX on
  self-seat state edges (crash entered / finish crossed / timer bumped); ?mute=1.
- test/audio.test.js (fake AudioContext: import-safe, engine osc, speed->pitch,
  one-shot SFX, disabled/muted) + import gate; specs/40. PLAYTEST §8 rewritten.

Gate: ./test.sh -> 174/174 + 4 Luau gates OK.

---

## marker-0043 — ws server hardening (2026-08-03)

Server-only, no repin. Defence-in-depth on the transport around the already
input-validated engine.
- server/rate_limit.js createRateLimiter: pure clock-injectable token bucket
  (default cap 60 / refill 40 msg/s); per-connection, over-rate msgs dropped.
- server/index.js: WebSocketServer maxPayload (4096B, roomOpts.maxMessageBytes)
  -> oversized frame closes 1009; app-layer size check; ws 'error' -> terminate
  (no uncaught crash); rate limiter gate before parseMessage.
- test/rate_limit.test.js + server_ws hardening cases (malformed/garbage survive,
  oversized -> 1009 + server keeps serving, 200-msg burst limited no crash);
  specs/41.

Gate: ./test.sh -> 180/180 + 4 Luau gates OK.

---

## marker-0044 — per-leg scenery themes (2026-08-03)

Renderer-only. CONTENT REPIN (conscious): spread segment scenerySet ids so fork
branches differ -> content hash a483515d79677564 -> 4cdff42d55b0f6af. scenerySet
is NOT in the engine state hash, so all engine goldens + 4 Luau gates UNCHANGED.
- data/roads.json: post-fork legs now scenerySet 2/3/4 (beach/canyon/forest) per
  course; opening legs stay 1 (sunset).
- data/scenery.json: scenerySet -> {sky, grassA/B, rumbleA, sprites[], every}.
- client/scenery.js loadScenery/themeFor (validate + fallback chain, never null).
- renderer_canvas.render(...,scenery): themed sky + drawRoad(theme) grass/rumble
  + drawScenery(theme) sprite kinds/density; road_renderer.drawRoad takes theme
  (defaults DEFAULT_THEME). main.js fetches data/scenery.json.
- test/scenery.test.js (parse/backfill/repair/mapping/fallback + every shipped
  segment resolves) + road_data content-hash repin + import gate; specs/42.

Gate: ./test.sh -> 185/185 + 4 Luau gates OK.

---

## marker-0045 — car identity on ghosts (2026-08-03)

Client-only, no repin. Rival ghosts tinted by their car (closes specs/39 follow-up).
- client/car_colors.js carColor(carId): per-car palette (red/blue/green/gold,
  grey fallback); kept OUT of data/cars.json so it never touches the content hash.
- renderer_canvas drawGhosts: fill each ghost with carColor(r.carId) (ghost
  already carries carId via server ghostFor); car_select draws name in carColor.
- test/car_colors.test.js: palette distinctness + integration render proving two
  ghosts (carId 2,3) tint the canvas + import gate; specs/43.

Gate: ./test.sh -> 187/187 + 4 Luau gates OK.

---

## marker-0046 — live feel-tuning knobs (2026-08-03)

Renderer-only, no repin (defaults unchanged; projection golden holds). Turns the
untuned camera/road feel constants into live URL knobs so the user's visual-feel
pass needs no edit/test round-trip.
- client/tuning.js: TUNING object (camDepth/camHeight/roadWidth/hillScale/
  camFollow/playerNearZ) + readTuning(params) parse+clamp + applyTuning mutate +
  drawTuningHud readout; TUNING_FIELDS drive params/clamps/labels.
- projection.js reads TUNING (CAMERA export removed); road_renderer hillScale;
  renderer_canvas camFollow/playerNearZ (unused CAMERA import dropped).
- main.js: applyTuning(readTuning(params)) at boot; ?tune=1 draws the readout.
  Knobs: ?depth ?height ?roadw ?hill ?follow ?nearz.
- test/tuning.test.js (parse/clamp/ignore/applyTuning/HUD) + import gate; specs/44.

Gate: ./test.sh -> 194/194 + 4 Luau gates OK.

---

## marker-0047 — feel-knob usable ranges (2026-08-03)

Renderer-only, no repin. Playtest feedback: hill=500 clipped the car through
crests; a road width ~500 was narrower than the car. Tightened TUNING_FIELDS
clamps to usable bounds so extreme params can't break the scene:
depth 0.5-1.4, height 800-2400, roadw 1400-3000, hill 40-320, follow 0.15-0.75,
nearz 1200-3200. Updated tuning clamp test + specs/44 (recommended values).

Gate: ./test.sh -> 194/194 + 4 Luau gates OK.

---

## marker-0048 — forks by lane position (2026-08-03)

Engine change, conscious repin. Forks are now physical: with no explicit Q/E, the
branch follows the car's laneX (left of centre -> left fork, at/right -> right).
Explicit choice still overrides.
- engine/road_progress.js advanceRoad: choice = forkChoice, else laneX<0 ? -1 : 1.
- luau/road_progress.luau mirrors it (fork_1a gate still byte-identical — that
  scenario uses an explicit choice, so the new branch never fires).
- REPIN (AI JS-only golden): AI now routes into the right branch (extra
  checkpoint) -> checkpoints 1->2, lastTick 297->316, 336dc614->946a2c0bc4652aab.
- test/forks.test.js: position picks fork (L/R/centre->R), explicit overrides.

Gate: ./test.sh -> 196/196 + 4 Luau gates OK.

---

## marker-0049 — race countdown 3-2-1-GO! (2026-08-03)

Client-only, no repin. Fresh LOCAL race freezes (no sim advance) during a
3-2-1-GO countdown so clock + car hold at the line until GO.
- client/countdown.js createCountdown: start/labelAt (3/2/1/GO!)/isDone/draw,
  time-driven, COUNTDOWN_MS ~3.1s.
- client/main.js: countdown.start() on race start; frame loop skips tick() +
  holds `last` while counting (smooth GO, no time jump); draws overlay. Remote is
  server-authoritative -> countdown local-only for now.
- test/countdown.test.js + import gate; specs/47.

Gate: ./test.sh -> 200/200 + 4 Luau gates OK.

---

## marker-0050 — fork preview (name + arrows) (2026-08-03)

Client-only, renderer, no repin. ~5s before a fork, "FORK AHEAD" names each
branch (by scenery theme) + left/right arrows, highlighting the side the car's
lane position would take. Replaces the bare Q/E hint.
- client/fork_preview.js: forkAhead (upcoming fork + distance to split),
  secondsToFork, branchName (reuses scenery theme name), drawForkPreview
  (shows within 5s or when close; highlights leaning side).
- renderer_canvas: drawForkHint removed, drawForkPreview(scenery) wired in.
- test/fork_preview.test.js + import gate; specs/46.

Gate: ./test.sh -> 206/206 + 4 Luau gates OK.

---

## marker-0051 — big centre race timer (2026-08-03)

Client-only, no repin. TIME is now a big number centred in the top ~13-24% of the
screen (the thing the player watches); SPEED stays small top-left; FINISH/TIME UP
retained. Red under 5s.
- client/hud.js drawHud: big centre time + label; test/hud.test.js added.

Gate: ./test.sh -> 209/209 + 4 Luau gates OK.

---

## marker-0052 — splash screen + loading bar (2026-08-03)

Client-only, no repin. SUNSET RUNNER splash over a sunset beach + palms with a
LOADING bar while client assets load.
- client/splash.js drawSplash(g,view,progress): sunset sky/sun/sea/sand + palm
  silhouettes + title + clamped loading bar. Fake-ctx-safe.
- client/main.js boot: per-fetch counter (grab .finally); splash rAF loop until
  all 6 assets in AND >=1400ms elapsed (no flash), then proceeds.
- test/splash.test.js + import gate; specs/49.

Gate: ./test.sh -> 212/212 + 4 Luau gates OK.

---

## marker-0053 — difficulty EASY/MEDIUM/HARD (2026-08-03)

Engine + client, NO repin (medium=100=identity; goldens + Luau twin unchanged).
- shared/constants.js DIFFICULTY {easy:130,medium:100,hard:75} timeScale %.
- engine/reducer.js: checkpoint bonus = truncDivI32(raw*timeScale,100) via
  ctx.timeScale (default 100). luau/reducer.luau mirrors (requires fixedmath).
- client/difficulty_select.js: three-button picker (createDifficultySelect,
  difficultyFromParams ?diff=, difficultyTouchZone, draw); main.js difficulty
  phase after car-select; session_local passes timeScale into ctx.
- ctx.timeScale is a context knob, not hashed state. Remote = server-authoritative
  -> difficulty local-only (first-player-selects is future server work).
- test/difficulty.test.js (600->780 easy /450 hard) + difficulty_select.test.js
  + import gate; specs/50.

Gate: ./test.sh -> 218/218 + 4 Luau gates OK.

---

## marker-0054 — course authoring + grand_tour (55 segments) (2026-08-03)

Content + tooling. CONTENT REPIN (conscious): +55 segments + course 4 ->
content hash 4cdff42d55b0f6af -> ac01b65fe5711df8, segment count 16 -> 71. Engine
goldens (courses 1-3) + 4 Luau gates UNCHANGED (grand_tour uses new ids >=100).
- shared/road_data.js: optional nameKey/seconds per segment (validated, NOT hashed).
- tools/build_course.mjs: seconds->stripCount @ CRUISE 2000, biome bands, 3
  rejoining forks, per-seg checkpoints (~90% refill), validates via loadCourseSet,
  leg-time report; idempotent (drops ids>=100 first); --check dry-run.
- data/roads.json: course 4 grand_tour, 55 segs, six biomes (sunset/beach/canyon/
  forest/city/night). data/scenery.json: added themes 5 city, 6 night.
- Play: ?course=4. test/build_course.test.js (course present, metadata, forks
  rejoin, walkable to finish). road_data.test count 16->71 + hash repin. specs/48.

Gate: ./test.sh -> 222/222 + 4 Luau gates OK.

---

## marker-0055 — race summary + restart countdown (2026-08-03)

Client-only, no repin. Race end -> field summary (rank + stage reached) -> 30s
countdown to a fresh race (local).
- client/race_summary.js: stageNumber (BFS hops from start), buildSummary
  (finishers first, then stage/roadZ), playersFromState (self+ghosts),
  drawRaceSummary, NEW_RACE_SECONDS=30.
- client/main.js: "summary" phase on self finish/timeout; sim frozen, confetti
  behind; auto-restart start(activeCarId,activeTimeScale) after 30s (local only).
- test/race_summary.test.js + import gate; specs/51.

Gate: ./test.sh -> 227/227 + 4 Luau gates OK.

---

## marker-0056 — traffic crash full stop (2026-08-03)

Engine change (playtest: partial slow made it too easy). Traffic crash now sets
seat.speed = 0 (was /3). luau mirrored. CONSCIOUS REPINS: checkpoint_1a finish
297->387 (073dace971711255), fork_1a ->217 (18837aa0a26d9051), physics_1a finish
387 (t500 2d3230b23f7fa0b7), AI 316/2cp->307/1cp (f4c71ed1b1ac3f46). collision_1a
(rival) unchanged. collision.test asserts dead stop + stun. specs/52.

Gate: ./test.sh -> 227/227 + 4 Luau gates OK.

---

## marker-0057 — restart polish (10s + clear confetti) (2026-08-03)

Client-only, no repin. Playtest fixes to the race-summary restart:
- NEW_RACE_SECONDS 30 -> 10 (race_summary.js).
- start() now calls celebration.reset() so the finish confetti/splash from the
  previous race clears when the new one begins (was lingering into the new race).
- specs/51 + PLAYTEST updated to 10s; race_summary.test NEW_RACE_SECONDS assert.

Gate: ./test.sh -> 227/227 + 4 Luau gates OK.

---

## marker-0058 — grand_tour tuned to a 50-stage sample track (2026-08-03)

Content + tooling. Tuned build_course BANDS (sunset 8->7, forest 8->7) so the
MAIN (left-fork) route is exactly 50 stages; build_course now reports main-route
stage count. Course 4 now 53 segments / 50-stage route (was 55). CONTENT REPIN
ac01b65fe5711df8 -> 939f1ef82438c7ef, segment count 71 -> 69. Engine goldens
(courses 1-3) + 4 Luau gates unchanged. road_data.test + build_course.test updated.

Gate: ./test.sh -> 227/227 + 4 Luau gates OK.

---

## marker-0059 — server-authoritative race framing (2026-08-03)

Server + client, NO repin (room orchestration; engine untouched).
- server/game_room.js: shared countdown freeze (countdownRemaining; tick() holds
  the sim until GO; viewFor.countdown seconds; countdownTicks default 0, entrypoint
  60). Room difficulty simCtx.timeScale set by first joiner + locked; getters
  countdown/timeScale; serialize/restore timeScale; restore marks raceStarted.
- shared/protocol.js JOIN optional diff (easy|medium|hard); server/index.js maps
  via DIFFICULTY to first joiner. session_remote sends diff + exposes countdown.
  main.js shows difficulty in remote too + draws server countdown
  (countdown.js drawCountdownLabel extracted).
- test/game_room.test.js (countdown freeze/GO, difficulty lock/default) +
  test/protocol.test.js (diff parse) + specs/53. PLAYTEST remote countdown item.

Gate: ./test.sh -> 233/233 + 4 Luau gates OK.

---

## marker-0060 — 10-terrain tour + no straight lines (2026-08-03)

Content + generator. CONTENT REPIN 939f1ef8 -> 681e1ad7c6111e75 (engine goldens +
Luau unchanged; course 4 only). Playtest refinements to grand_tour:
- No straight lines: build_course CURVES have no sustained 0 run (every leg turns);
  stage 1 opens on an S-curve + crest (showcase).
- 10 terrains: scenery.json themes 7 wheat, 8 lake, 9 autumn, 10 mountain, 11
  alpine added; BANDS progress palm->beach->wheat->lake->forest->autumn->canyon->
  mountain->alpine->night (50-stage main route, 3 forks with terrain detours).
- test/build_course.test.js: no-straight rule, stage-1 showcase, terrain variety
  (>=8); scenerySet range ->11. road_data content-hash repin.

Gate: ./test.sh -> 236/236 + 4 Luau gates OK.

---

## marker-0061 — checkpoint banners (2026-08-03)

Client-only, renderer, no repin. A CHECKPOINT gantry at each upcoming checkpoint
boundary: two posts at the road edges + a "CHECKPOINT" banner slung between them
at tree-line height, projected into the 3D road.
- client/checkpoint_banner.js checkpointAhead (distance to next checkpoint seg)
  + CHECKPOINT_DRAW_RANGE; renderer_canvas drawCheckpointBanner (posts + banner).
- test/checkpoint_banner.test.js (checkpointAhead + render integration draws
  "CHECKPOINT") + import gate.

Gate: ./test.sh -> 239/239 + 4 Luau gates OK.

---

## marker-0062 — tuning feedback: hills 320 + per-stage road width (2026-08-03)

Client-only, no repin. From playtest ?tune screenshots.
- client/tuning.js: hillScale default 180 -> 320 (hills now read clearly).
- Per-terrain road width: scenery.js theme.roadScale (default 1); scenery.json
  beach/wheat 1.15, lake 1.1 (wide/easy), mountain 0.85, alpine 0.8 (slim).
  renderer_canvas overrides TUNING.roadWidth by theme.roadScale per frame
  (restored after), so the road narrows on hard terrains.
- test/scenery.test.js roadScale; tuning.md + specs/44 updated.

Gate: ./test.sh -> 240/240 + 4 Luau gates OK.

---

## marker-0063 — side terrain (water) + road sheen (2026-08-03)

Client-only, no repin (tranche 2). Terrains now differ beyond palette:
- scenery.js theme.sideLeft/sideRight (ground colour per side) + theme.sheen (0..1).
- road_renderer.drawRoad paints side terrain over the grass (road covers mid) +
  an icy/wet centre sheen strip on alternate bands.
- scenery.json: beach sea on the right, lake ponds on the left, alpine icy sheen
  0.28, mountain 0.12, night 0.15 (wet neon).
- test/scenery.test.js side/sheen parse + clamp.

Gate: ./test.sh -> 241/241 + 4 Luau gates OK.

---

## marker-0064 — fir + wheat sprites (2026-08-03)

Client + asset content, no engine repin. build_assets catalog gains fir
(snow-capped conifer, kind fir) + wheat (kind crop); sprite_renderer draws both.
scenery.json: forest/mountain/alpine use fir, wheat uses wheat. Manifest repinned
strip 264->356, hash 09f1ccd6->cf64cb17d40914fc. specs/54 (tranche 2 summary).

Gate: ./test.sh -> 241/241 + 4 Luau gates OK.

---

## marker-0065 — default course 4 + visible road fork (2026-08-03)

Client + server config, no repin.
- Default course -> 4 (grand_tour): main.js courseId default 4; server entrypoint
  courseId 4. Old short course still ?course=1 (quick fork+finish test).
- Visible fork: forwardStrips builds the right branch in parallel past a fork
  split (forkLeftCurveX/forkRightCurveX + growing sep); drawRoad draws both
  ribbons (grass median between) so the road physically Y-splits into a left and
  right curve. test/fork_road.test.js. specs/55.

Gate: ./test.sh -> 244/244 + 4 Luau gates OK.

---

## marker-0066 — cross-hazards (skiers/snowmobiles), state v2 (2026-08-03)

Engine + Luau twin (tranche 3). STATE_VERSION 1->2; FULL conscious repin (course
1/2 behaviour identical — hazards gate on scenerySet 10/11, course-4 only).
- state.hazards + nextHazardId; traffic.js spawnSegmentHazards (distinct RNG,
  after traffic rolls) + advanceHazards; collision.js resolveHazardCollisions
  (dead stop + stun). reducer tick order 8c/9b. copy_state + snapshot mirror.
  shared/collision HAZARD_* consts.
- Luau: state/traffic/collision/copy_state/snapshot/reducer/constants/spine-check
  mirrored -> 4 gates byte-identical.
- Repins: spine 6ed9caba, checkpoint e38e85c1, collision c7509672, fork
  21ae1f3f, physics t500 1d8e8876, AI 14fb758b.
- Render: drawHazards (sprite by kind + rect fallback); viewFor+remote carry
  hazards. test/hazards.test.js. CLAUDE.md tick order updated. specs/56.

Gate: ./test.sh -> 249/249 + 4 Luau gates OK.

---

## marker-0067 — balanced course elements + downhill + checkpoint horizon (2026-08-03)

Content + client, content repin (course 4 only; engine goldens + Luau unchanged).
Playtest: course 4 was "all corners"; checkpoints appeared too late.
- build_course legCurve: every stage OPENS with a straight (3-8s) then alternates
  straight<->curve elements (~7s each, no two straights adjacent -> no straight
  >8s), flipping direction. legHill: rolling; mountain(10)/alpine(11) DESCEND
  then climb (downhill). Fork branches = constant sweeps (visible split).
- Content hash 681e1ad7 -> f1cc22a21c0be22a.
- checkpoint_banner: CHECKPOINT_DRAW_RANGE 45 -> 200 strips + draw until passed,
  so gantries appear on the horizon and scale up.

Gate: ./test.sh -> 249/249 + 4 Luau gates OK.

---

## marker-0068 — snowmobile + skier sprites (2026-08-03)

Client + asset content, no engine repin. build_assets catalog gains snowmobile
(kind snowmobile) + skier (kind skier); sprite_renderer draws both; renderer
HAZARD_SPRITE already maps kind 3/4 to them. Manifest repinned strip 356->446,
hash cf64cb17->02a69f4c675cfd3d. assets.test asserts hazard sprites present.

Gate: ./test.sh -> 249/249 + 4 Luau gates OK.

---

## marker-0069 — HUD: big speed (bottom-right) + stage (bottom-left) (2026-08-04)

Client-only, no repin. Playtest HUD rework.
- hud.js drawHud: SPEED moved to bottom-right at ~3x size; new STAGE n/NN
  bottom-left (same size, cyan); FINISH/TIME UP under the centre timer.
- render(...,hud) threads {stage,total}; main computes via race_summary
  stageNumber + new stageTotal (main-route stage count). test/hud.test.js stage.

Gate: ./test.sh -> 250/250 + 4 Luau gates OK.

---

## marker-0070 — car-select side-profile picture (2026-08-04)

Client-only, no repin. car_select.drawCarProfile draws a side-view car
silhouette (body/cabin/windows/headlight/wheels) in the car's identity colour,
shown while browsing; stat bars shifted down to make room.

Gate: ./test.sh -> 250/250 + 4 Luau gates OK.

---

## marker-0071 — stage durations 60->240s ramp + stage announcement (2026-08-04)

Content repin (course 4) + client. Playtest: stages too short/uniform.
- build_course stageSeconds ramps 60s (stage 1) -> 240s (last); elementCount
  uncapped so long legs keep ~7s elements. Content hash f1cc22a2 -> e3f839ac3a731bf3.
- client/stage_announce.js: "STAGE n — NAME" banner (fade in/out) on entering a
  new segment; main tracks prevSegmentId, resets per race. build_course.test +
  report ranges updated to 55-250s.

Gate: ./test.sh -> 253/253 + 4 Luau gates OK.

---

## marker-0072 — more traffic: bus + motorcycle, density 6 (2026-08-04)

Content + client, behavioural repin (traffic changed on ALL courses). No Luau
CODE change (twin reads data/traffic.json -> reproduces the new traffic).
- data/traffic.json density 4->6 + kinds bus(3, 620) + motorcycle(4, 1050).
- build_assets traffic_bus (car) + traffic_motorcycle (moto kind); sprite_renderer
  moto draw; TRAFFIC_SPRITE +3/4 (renderer + build). Manifest strip 446->540, hash
  02a69f4c->f8972c86dc06b329.
- REPINS: checkpoint_1a 33cc7af2 (finish 387->450), collision_1a 28b78c37, fork_1a
  618009433b83304d, physics t500 886bab67 finish 450, AI 3ce72c58 (still finishes).
  Luau gates reproduce byte-identical.
- traffic.test density 6 + 4 kinds; assets.test strip 540 + bus/moto present.

Gate: ./test.sh -> 253/253 + 4 Luau gates OK.

---

## marker-0073 — multiplayer name tags + horizon dots (2026-08-04)

Client-only, no repin. drawGhosts:
- In-view rivals (same segment ahead) get a NAME TAG above the car that scales
  with the projected size (bigger as they near from the horizon).
- Rivals further along the course get a small DOT + name near the horizon, in
  race order (top 5). Labels are P{seatId} (real player names TBD — needs a
  name-entry field); coloured by car identity.
- test/ghost_labels.test.js (render integration: name tag + horizon label).

Gate: ./test.sh -> 254/254 + 4 Luau gates OK.

---

## marker-0074 — traffic density scales with segment length (2026-08-04)

Engine + Luau, NO repin. Playtest: course 4 felt empty (fixed count spread over
long stages). Traffic count = max(cfg.density, round(stripCount/100)) — density is
the FLOOR. Courses 1-3 (all <= 500 strips) stay at 6 -> goldens unchanged; course-4
stages now 94-375 cars (~16-60x). luau/traffic mirrors (math.round). traffic.test
scaling case.

Gate: ./test.sh -> 254/254 + 4 Luau gates OK.

---

## marker-0075 — sports-car profiles + first-stage announce delay (2026-08-04)

Client-only, no repin.
- car_select.drawCarProfile: low sleek sports silhouette (wedge nose, raked
  cabin, big wheels/hubs, accent stripe) with per-car CAR_STYLE (mid-engine/
  fastback/long-hood/muscle) so the four cars look distinct.
- main.js: first stage-entry announcement held until the 3-2-1-GO countdown
  finishes (preRace gate, local + server countdown), so it doesn't collide with GO.

Gate: ./test.sh -> 255/255 + 4 Luau gates OK.

---

## marker-0076 — real player names (2026-08-04)

Client + server, no repin. Players name themselves; the name tags rivals.
- client/name_entry.js (nameFromParams ?name/localStorage; typed createNameEntry);
  main.js "name" phase (remote, first time), remembered.
- protocol JOIN optional name (sanitised, cap 12). game_room addSeat(...,name),
  ghostFor name, nameFor, serialize/restore names. session_remote sends name;
  renderer name tags/horizon dots use ghost.name.
- tests: protocol name, name_entry, game_room name; ghosts/protocol shape updates.
  specs/57.

Gate: ./test.sh -> 260/260 + 4 Luau gates OK.

---

## marker-0077 — multiplayer time-up: Re-join / Spectate (2026-08-04)

Client-only, no repin. Remote race end -> RE-JOIN / SPECTATE (was local auto-restart).
- client/spectate.js: drawTimeUpButtons + timeUpTouchZone; drawSpectateOverlay +
  spectateTouchZone. race_summary skips the countdown line when secs<0.
- main.js: remote summary shows buttons (nav ◄►/Enter/tap); "spectate" phase
  renders a rival's POV (synthetic self from the ghost) + name centre-bottom, ◄►
  cycles, Enter/centre re-joins. session stays live.
- DEFERRED: re-join restarts from start (not current stage); no points system;
  spectate traffic feed is the viewer's. test/spectate.test.js. specs/58.

Gate: ./test.sh -> 263/263 + 4 Luau gates OK.

---

## marker-0078 — points / scoreboard (server-authoritative) (2026-08-04)

Server + client, no repin (points not hashed). game_room: per-seat points scored
from events each tick (checkpoint +100 / finish +1000 / collision -30, clamped>=0);
pointsFor; viewFor.points + scoreboard (sorted, name+carId); serialize/restore.
session_remote points/scoreboard getters; HUD SCORE top-left (MP); race summary
built from server scoreboard (N PTS) in MP, stage-based solo. test/game_room.test
points+scoreboard. specs/59.

Gate: ./test.sh -> 264/264 + 4 Luau gates OK.

---

## marker-0079 — spectate feed verified + own-car + mini scoreboard (2026-08-04)

Client-only, no repin. #2: the server VIEW is already a GLOBAL traffic/hazard feed
(viewFor sends state.traffic/state.hazards whole), so the spectate render shows the
target's traffic correctly (filtered client-side to the target segment). Improved
spectate: show the spectator's own stopped car among rivals + a live mini
scoreboard (spectate.drawMiniScoreboard). game_room test asserts the view carries
the full traffic array. specs/58 corrected.

Gate: ./test.sh -> 266/266 + 4 Luau gates OK.

---

## marker-0080 — token-keyed points (carry score across re-join) (2026-08-04)

Server + client, no repin (points not hashed). Points now keyed by a persistent
client pid so a re-join keeps its score.
- client/player_id.js: playerId(store) mint+persist in localStorage; main sends
  pid; session_remote JOIN pid. protocol JOIN pid (sanitised, cap 64).
- game_room: playerId seatId->pid map; points keyed by pid; scoreFor(seatId) via
  pid; addSeat(...,pid); viewFor/scoreboard via scoreFor; serialize/restore
  playerId. Re-join with same pid continues the tally.
- tests: game_room carry-across-rejoin, protocol pid, player_id; protocol shape.

Gate: ./test.sh -> 269/269 + 4 Luau gates OK.

---

## marker-0081 — Playwright browser smoke (2026-08-05)

Test harness, no repin. Headless-Chromium smoke (test/browser_smoke.mjs): boots
the client against the real server and asserts no console errors + the canvas
renders, for local AND ?mode=remote (ws connect path / Pitfall #7). playwright
devDependency; standalone (not node --test) so npm test stays browser-free.
test.sh runs it after JS+Luau when playwright is resolvable (SKIP_BROWSER=1 to
skip); npm run test:browser. specs/60. Summary: js=0 luau=0 browser=0.

Gate: ./test.sh -> 269/269 + 4 Luau gates + browser smoke OK.

---

## marker-0082 — AI opponents in single-player (2026-08-05)

Client-only, no repin. Solo is now a RACE: session_local spawns opts.aiCount AI
seats (staggered lanes, cars cycled), drives each with engine/ai_driver chooseInput
each tick, and exposes them as named ghosts (AI_NAMES pool) so they render with
name tags like real players. main: aiCount default 5 solo (?ai=N override, ?ai=0
off; remote unchanged). getState now returns {seats:[self], ghosts, ...}.
test/local_ai.test.js (named ghosts, drive forward, deterministic, ai=0 solo).

Gate: ./test.sh -> 273/273 + 4 Luau gates + browser smoke OK.

---

## marker-0083 — shorten grand_tour to 30 stages / ~1 hour (2026-08-05)

Content repin (course 4). Playtest: 2h was too long. BANDS reduced (~3 legs/band,
3 forks) -> 30-stage main route, 33 segments; stageSeconds ramp 60->180s (was
->240). Left-route ~3596s (~60 min). Content hash e3f839ac -> 6430e6d2f164f9cd;
segment count 69->49. road_data + build_course tests updated. Engine goldens/Luau
unchanged (course 4 only).

Gate: ./test.sh -> 273/273 + 4 Luau gates + browser smoke OK.

---

## marker-0084 — all-time leaderboard (2026-08-05)

Server + client, no repin. Persistent high-score board: finishers by time, others
by stage reached (finishers on top), best run per name.
- shared/leaderboard.js (rankResults/mergeResult/isBetter); shared/road_data
  stageIndex (BFS). server/leaderboard.js (file persist); game_room records
  finish(time)/timeout(stage) events + viewFor.leaderboard; startServer
  leaderboardPath (.state/leaderboard.json). client/local_scores.js (solo
  localStorage); race_summary.drawLeaderboard ALL-TIME panel; main records solo +
  shows server board in MP. session_remote.leaderboard.
- tests: leaderboard (rank/merge/local), game_room timeout->board. specs/61.

Gate: ./test.sh -> 277/277 + 4 Luau gates + browser smoke OK.

---

## marker-0085 — pre-race lobby + invite/QR (2026-08-05)

Server + client, no repin. First joiner opens a LOBBY (phase idle->lobby->racing);
auto-start timer (lobbyTicks; entrypoint 600=30s, default 0 so tests/smoke race
immediately). game_room: startNow/toggleWait, viewFor.lobby {active,seconds,paused,
players}; protocol START/WAIT; server handlers. client/lobby.js drawLobby (START
NOW/WAIT/INVITE + QR overlay), inviteUrl (?mode=remote), vendored
client/vendor/qrcode.min.js (qrcode-generator, MIT; RetroMultiCiv pattern). main:
lobby shown while session.lobby.active, tap/key input. session_remote lobby +
startNow/toggleWait. tests: lobby, game_room lobby, protocol. specs/62.

Gate: ./test.sh -> 283/283 + 4 Luau gates + browser smoke OK.

---

## marker-0086 — spectate ongoing race + join-in (2026-08-05)

Server + client, no repin. Late-comer watches a running race then JOIN INs at the
current stage (earns only stages run from there).
- game_room: leader()/leaderSegment(); addSeat spawns at leaderSegment when
  phase==="racing"; spectatorView() (leader POV + all ghosts + scoreboard/lb,
  watching:true). index.js: sockets Set, HELLO.phase, spectator broadcast to
  non-seated sockets. session_remote: onopen waits for HELLO; HELLO racing+players
  -> watch (no auto-join), else join; watching getter; join(). main: watching
  render (leader POV + JOIN IN prompt, tap/Enter). tests: late-join stage,
  spectatorView. specs/63.

Gate: ./test.sh -> 285/285 + 4 Luau gates + browser smoke OK.

---

## marker-0087 — analog steering (STEER_UNIT) (2026-08-05)

Engine + client + Luau, NO repin. steer becomes a signed magnitude in
STEER_UNIT=256 units (±256 = full lock, intermediate = analog). Physics divides
by STEER_UNIT so full lock is byte-identical to the old ±1 -> AI golden hash and
all 4 Luau gates unchanged.
- shared/constants.js: STEER_UNIT=256. commands.js + protocol.js: isSteer range
  [-256,256] (was tri-state). car_physics.js stepLateral:
  truncDivI32(steerHeld*steerRate, STEER_UNIT). luau/car_physics.luau mirrors it.
- inputs: keyboard/AI emit ±STEER_UNIT (full lock); touch_controls.js left thumb
  is now an analog drag PAD (STEER_PAD, PAD_RANGE=0.14=full lock) replacing the
  ◄ ► buttons, with a thumb-dot indicator.
- tests: physics (full/half/mirror), protocol (range accept/reject), ai_driver
  (±256, hash unchanged), touch_controls (drag steer + multi-touch). specs/64.

Gate: ./test.sh -> 287/287 + 4 Luau gates byte-identical + browser smoke OK.

---

## marker-0088 — mobile render perf profile (2026-08-05)

Client measurement, no engine change. tools/mobile_perf.mjs (npm run perf:mobile):
Playwright boots the real client at 390x844 DPR3 on course 4, launches Chromium
with frame-rate limit OFF, throttles CPU via CDP (1x/4x/6x = desktop/mid/low-end
phone), warms 5s past splash+countdown, samples 5s of rAF deltas, reports
p50/p95/p99 ms + ~fps + over-budget fractions. Standalone (not in test.sh; it is a
measurement, not a gate). FINDING: mid (4x) ~60fps median, low-end (6x) ~38fps but
90% of frames clear 30fps; cost is Canvas 2D fill at DPR3, not the engine
(~0.04ms/tick). Numbers + cheapest low-end wins (cap DPR, shorten draw distance)
in PERFORMANCE.md. specs/65.

---

## marker-0089 — ssh-deploy script + /health (2026-08-05)

Deploy tooling for the shared Hetzner box. server/index.js: GET /health + /healthz
-> 200 "ok" (deploy guard + nginx/uptime); optional host bind (roomOpts.host / env
HOST=127.0.0.1 on the box, else all interfaces for tests/dev); LEADERBOARD_FILE env
so runtime state lives outside deployed code. docs/ssh-deploy.sh: allowlist rsync
(client/shared/engine/server/data + package + LICENSE; --delete safe since state/
sits beside code), one SSH mux, provenance guard (dirty tree stops unless --yes),
health guard (local /health then PUBLIC_URL). docs/deploy.env.example template +
docs/DEPLOYING.md playbook (systemd unit w/ MemoryMax + HOST + state paths, HTTP-
first certbot). SECURITY SPLIT (per user): ops/ is fully gitignored (real host info,
sibling howto, secret deploy.env); generic templates tracked in docs/. specs/66.

No repin (health/host are transport). Gate: ./test.sh -> 288/288 + 4 Luau + browser.

---

## marker-0090 — playtest polish: rival cars + checkpoint board + summary layout (2026-08-05)

Client-only (presentation), no engine change, no repin.
1. renderer_canvas.drawGhosts: rivals now draw the CAR SPRITE tinted to their
   identity colour (rivalCarSprite + darken), not a flat rect; crash flashes white.
   Flat-rect stays as the no-assets fallback.
2. NEW client/checkpoint_standings.js: records each racer's first-observed arrival
   in a checkpoint segment; when the local car crosses one, shows a numbered board
   for ~5s (1s fade) with each racer's seconds-behind-leader, at 2.5x the HUD
   standings font. Wired in main.js. Unit-tested (gap/fade/expiry/non-cp).
3. race_summary: field panel pulled to the LEFT half (rank 0.08/name 0.14/result
   0.55) and drawLeaderboard slimmed to a right column (0.64->edge, smaller font,
   names clipped) so the summary + all-time board no longer overlap.

specs/67. Gate: npm test -> 291/291 + browser smoke OK; 4 Luau gates untouched.

---

## marker-0091 — deploy artifacts (systemd unit + nginx block) (2026-08-10)

Docs/ops only, no code change, no repin. Followed the shared-box hosting pattern
to finish the deploy tooling started in marker-0089. SECURITY SPLIT held strictly:
every host-specific value (real domain, claimed port, SSH target, filled configs)
lives ONLY in gitignored ops/; docs/ carries generic placeholder templates.

- **Port (step 2):** the port assumed in marker-0089 collided with a neighbour on
  the shared box. Claimed a free port and recorded it in the gitignored shared-box
  registry + ops/deploy.env. No real port in any tracked file.
- **systemd unit (step 3):** NEW docs/sunset-runner.service.example (placeholders
  <USER>/<PORT>) — HOST=127.0.0.1, MemoryMax/CPUQuota/TasksMax,
  ProtectSystem=strict + ReadWritePaths=state, state paths outside the code dir.
  The filled copy is ops/sunset-runner.service (gitignored). docs/ssh-deploy.sh
  gains `--bootstrap` (create user+dirs, scp+enable the FILLED ops/ unit).
- **nginx block (step 4):** NEW docs/sunset-runner.nginx.conf.example (placeholders
  <DOMAIN>/<PORT>) — HTTP-only (certbot writes TLS), proxies location / with the
  WebSocket upgrade headers (the game's ws shares the HTTP server at the root, no
  /ws prefix), references the shared connection_upgrade map without redeclaring it.
  Filled copy is ops/sunset-runner.nginx.conf (gitignored).
- **ssh-deploy.sh:** fixed the port-ownership check (grep -w ':PORT' can never
  match 127.0.0.1:PORT — digit-before-colon breaks the word boundary; use ss's
  `sport = :PORT` filter, per the sibling's own finding). Added `--dry`. Generic
  dev port default (8000); the real port comes from ops/deploy.env.
- DEPLOYING.md + deploy.env.example + plan backlog rewritten to the template/ops
  split with placeholders only.

Remaining GO-LIVE work is on-box only (agent can't reach the box): fill the ops/
configs, `--bootstrap`, install the nginx block, extend the shared certbot
lineage, `./docs/ssh-deploy.sh`.
Gate: bash -n docs/ssh-deploy.sh OK; npm test unaffected (no code change).

---

## marker-0092 — cap effective DPR at 2 on mobile (2026-08-10)

Client-only (presentation), no engine change, no repin. The cheapest low-end perf
win from the marker-0088 profile.

client/viewport.js: computeBufferSize now clamps the EFFECTIVE devicePixelRatio to
maxDpr (default 2, exposed as a param) before scaling — a DPR-3 phone renders a
780-wide backing store instead of 1170. DPR 1/2 unchanged; the maxW=1920 cap
unchanged. No call-site change (the clamp is inside the pure function). Canvas-2D
fill is quadratic in backing-store pixels, so 3->2 is a ~2.25x fill cut for detail
the eye can't resolve at arm's length.

Measured (npm run perf:mobile, 390x844 @ device DPR 3): 4x CPU 16.0->10.0ms p50,
62->100 fps, 39%->3% over 16.7ms; 6x 26.2->15.6ms p50, 38->64 fps, 100%->30% over.
test/viewport.test.js gains a clamp case (780 not 1170, DPR1/2 untouched,
overridable). specs/68. PERFORMANCE.md table refreshed + item 1 marked done.

Gate: npm test -> 292/292; perf:mobile reproduces the table; 4 Luau gates untouched
(no engine change).

---

## marker-0093 — crash impact feel: screen shake + red flash (2026-08-10)

Client-only (presentation), no engine change, no repin, no Luau change. Backlog
"richer crash/near-miss feel".

NEW client/crash_feel.js (createCrashFeel): on the local car's crash edge, two
short decaying wall-clock effects over the float Canvas — a ~420ms two-frequency
screen shake (amplitude scales with view height; applied by translating the scene
around the render() call in main.js) and a ~260ms red radial impact vignette
(strong at edges, clear centre so the road stays readable). Triggered in the same
crash-edge branch as audio.event("crash") (crashedTicks>0 && prevCrashed===0),
reset on race start next to celebration.reset().

Reads no engine state beyond the crash edge; the engine crash + stun and their
hashes are untouched. test/crash_feel.test.js locks the timing contract (shake
zero before/after, non-zero + decaying during; flash only inside its window;
active()/reset()). specs/69.

Gate: npm test -> 296/296; ./test.sh browser smoke boots clean (render-wrap
renders without console errors); 4 Luau gates untouched.

---

## marker-0094 — near-miss feel: client-detected whoosh + streak (2026-08-10)

Client-only (presentation), no engine change, no repin, no Luau change. Wires the
nearmiss SFX that lived in client/audio.js but was never fired.

NEW client/near_miss.js (createNearMiss): the engine has no near-miss event (crash
is authoritative + hashed; a near miss is cosmetic), so it's detected on the client
from rendered traffic, mirroring shared/collision.js geometry so the band sits just
outside a crash. Per frame, for traffic on the local car's segment: |dRoadZ| <
CAR_LENGTH(512) AND CAR_WIDTH(200) <= |dLaneX| < NEAR_WIDTH(460). Suppressed while
crashed/off-track/different-segment; each traffic id fires once (Set pruned on
despawn); a 250ms cooldown collapses dense-traffic bursts to one whoosh. update()
returns 1 on a new fire -> main.js plays audio.event("nearmiss"); a ~220ms white
side speed-streak fades in from the pass side. reset() on race start.

Reads engine state read-only, writes nothing; hashes/fixtures/Luau untouched.
test/near_miss.test.js (6 cases: fire+dedup, crash/far/behind rejects, crashed/
off-track/other-segment suppression, cooldown collapse, reset re-arm, streak side
+ window). specs/70.

Gate: npm test -> 302/302; ./test.sh browser smoke clean; 4 Luau gates untouched.

---

## marker-0095 — in-race music track select (2026-08-10)

Client-only (audio/presentation), no engine change, no repin, no Luau change.
Backlog "in-race music track select".

client/audio.js: single MUSIC_LOOP -> TRACKS table of 4 procedural loops (SUNSET
triangle [the original, track 0 = unchanged default], NEON square, COAST sine,
CHROME sawtooth) sharing tempo, differing in melody + oscillator wave, so the
scheduler just reads the active track. New API: get track {index,name,count},
setTrack(i) (wraps), cycleTrack(); createAudio({track}) sets the initial one.
input.js: M is an edge event (readMusicCycle(), Q/E-style queue). main.js: on the
M edge (any phase) cycleTrack() + toast "♪ NAME" via the stage announcer + persist
to localStorage["sunset.music.track"]; startup reads that key or ?track=N.

test/audio.test.js +3 (default track0/triangle, select+cycle+wrap, next note
timbre follows the track, construct from opts.track). README controls table gains
the M key. specs/71.

Gate: npm test -> 305/305; ./test.sh browser smoke clean; 4 Luau gates untouched.

---

## marker-0096 — AI difficulty tiers (2026-08-10)

Engine (ai_driver.js) + client wiring. NO golden repin, NO Luau change.

engine/ai_driver.js: AI_SKILL {easy/medium/hard} + skillFor()/DEFAULT_SKILL.
chooseInput(state, seatId, skill=DEFAULT_SKILL) uses skill.lookahead for the
traffic scan and a deterministic throttle duty cycle keyed on state.tick
((tick % throttlePeriod) < throttleOn) — no wall-clock, integer-only. easy:
lookahead 3000, gas 3/4 (late dodges + coasts = slower); medium: 6000, gas every
tick = THE ORIGINAL behaviour; hard: 9000, gas every tick (sees furthest).

WHY NO REPIN: medium reproduces prior behaviour exactly (throttlePeriod 1 =>
tick%1<1 always true; lookahead 6000). The AI golden path runAiRace ->
chooseInput(state,id) defaults to medium, so its inputs are byte-identical: the
pinned AI golden 3ce72c5877d79295 (tick 307, 1 cp) is unchanged, and the AI is a
command SOURCE not part of the reducer contract so the 4 Luau gates are untouched.

Wiring: session_local opts.aiSkill -> skillFor() -> every AI seat's chooseInput;
main.js passes diffLevel (EASY/MED/HARD keys already match AI_SKILL keys). MP AI
unaffected (server has no AI seats). test/ai_driver.test.js +3 (default=medium,
easy duty cycle, hard lookahead reacts where easy doesn't). specs/72. README
difficulty feature line updated.

Gate: npm test -> 308/308; ./test.sh 4 Luau gates + browser smoke green.

---

## marker-0097 — boost pads (power-ups) (2026-08-10)

Engine + Luau twin + client render. FULL golden repin (STATE_VERSION 2->3) + a NEW
boost_1a parity gate (the 5th). The biggest cross-language slice since hazards
(0066).

DESIGN — pads are DATA, boost is one field. Only new hashed state: seat.boostTicks.
Pads are course data (segment.boostPads: [{roadZ,laneX}]) read from ctx like
checkpoints/curves, never stored in state. engine/boost.js resolveBoostPickups
(tick step 9c): a seat within PAD_LENGTH(512) along / PAD_WIDTH(256) lateral of a
pad on its segment gets boostTicks=BOOST_TICKS(40); pads are fixed markers, not
consumed. car_physics.stepLongitudinal: while boostTicks>0, +BOOST_ACCEL(90) shove
and cap +BOOST_SPEED(512). reducer decrements boostTicks (step 3b, next to crash
stun). boostTicks=0 on courses without pads => those runs behaviour-identical.

GATING: pads only on course 4 (grand_tour segs 100/102/106). Courses 1-3 have
none, so the 4 milestone goldens keep their exact sim and repin only for the
version+field bytes. boostPads added to the content-drift pin.

LUAU TWIN: mirrored constants/state/car_physics/reducer/snapshot + NEW luau/
boost.luau; copy_state/road_data unchanged (copy/carry all fields). NEW
luau/boost-1a-check.luau (course 4, seed 777, accel-only; pad at ~tick 20 lifts
speed to 2912 = 2400+512). 5th lune gate wired into test.sh + luau_engine.test.js.

REPIN (conscious): spine hashState_spine0 1f5ad3cc9944ec92 + luau spine version 3;
checkpoint_1a 2fc22acd892b310d, collision_1a ffbad0df89bb497e, fork_1a
52f3496b79b37d16, physics_1a t500 df45ddf3f1511fb7, AI 43762b8616301876; content
1338dbe83fe3de41 (+boostPads). All census/finish ticks UNCHANGED.

CLIENT: renderer_canvas drawBoostPads (glowing cyan double-chevron on the road) +
drawBoostEffect (cyan speed streaks while boosting). Presentation only.
test/boost.test.js (physics branch, data pickup on/off, boost_1a golden, speed
exceeds base cap). specs/73. Tick order in CLAUDE.md updated (3b countdown, 9c
pickup). README features + Luau badge (4->5 gates).

Gate: npm test -> 313/313; ./test.sh 5 Luau gates + browser smoke green.

---

## marker-0098 — Roblox host layer (playable 3D-Parts build) (2026-08-10)

Adds roblox/src (host + presentation) on top of the Luau engine twin. NO engine/
shared/luau-module change -> the 5 lune parity gates + JS suite are untouched, so
the Roblox sim stays byte-identical to the browser. User had Studio + Rojo connected;
chose 3D Parts over a ported-2D canvas.

SERVER roblox/src/server/GameServer.server.luau: requires ReplicatedStorage.Shared
engine modules + GameData (Rojo JSON tables), ctx={courseSet,carSet,trafficConfig},
runs ONE solo race per player on course 4 at 20Hz via a Heartbeat accumulator
(apply INPUT -> optional FORK -> ADVANCE), streams per-seat view over a SunsetView
RemoteEvent, reads intents from SunsetInput. Finish/timeout loops a fresh race.
CharacterAutoLoads=false (car is a Part, not an avatar). Mirrors server/index.js +
game_room.js.

CLIENT Main.client.luau + Render.luau: UserInputService -> intents (steer ±256 =
STEER_UNIT; WASD/arrows/QE). Render = 3D-Parts treadmill: pooled ~80 road Parts
positioned each view from a client buildStrips (walks the course, accumulates curve
double-integral like road_renderer.js, reads hill); pooled traffic + boost-pad
Parts placed by depth; chase camera follows the car Part each RenderStepped; ScreenGui
HUD (speed/timer/BOOST!/FINISH!/TIME UP). Presentation only.

roblox/default.project.json: globIgnorePaths excludes the lune-only *-check.luau from
the sync. roblox/*.rbxl/*.lock gitignored (Rojo is source of truth). roblox/README.md
+ specs/74. Backlog: AI opponents (needs ai_driver Luau port), multiplayer/ghosts,
race framing, art pass, mobile.

Gate: rojo build produces a valid place (GameServer/Main/Render synced, checks
excluded); npm test -> 313/313 + 5 Luau gates unaffected. In-Studio play = manual.

(Follow-up, unnumbered fix pushed same day: harden the Roblox host for the
empty-world case — WaitForChild the replicated modules, lift the world to y=50,
lay a straight default road + boot prints so Output localises a non-syncing
session; README troubleshooting. User confirmed Studio play works after
reconnecting Rojo.)

---

## marker-0099 — multiplayer polish (countdown/spectate/rejoin/strand) (2026-08-11)

Client-only (presentation + reconnect control), no engine/shared change, no repin,
no Luau change. Closes the three open MP items.

1. SERVER-AUTHORITATIVE COUNTDOWN: server already freezes the sim + sends countdown
   secs (0059). main.js now FREEZES input while session.countdown>0 in remote (sends
   neutral input so prediction doesn't lurch/snap), and shows the number then a brief
   "GO!" + blip on the >0->0 edge (prevRemoteCd/goAt).
2. TIME-UP SPECTATE: spectate.js drawSpectateOverlay gains an optional points arg
   (shows the spectated player's points); main.js cycles rivals in RANK order (server
   scoreboard) not arbitrary ghost order, passing that player's points.
3. REJOIN BUTTON + STRAND TEST: session_remote.reconnectNow() (skip backoff, reopen
   if dead). connection_banner showRejoinButton/rejoinButtonRect/rejoinButtonHit + a
   "TAP TO REJOIN NOW" button under the banner while reconnecting/run_ended; main.js
   wires the tap (any phase) + the R key. NEW browser-level strand test (Pitfall #7):
   browser_smoke checkStrand boots remote, drops the server, restarts it on the same
   port, and asserts via Playwright ws observation that a 2nd socket opens + receives
   frames (never stranded); ws-refused console noise filtered during the outage.

test/connection_banner.test.js +2 (rejoin button logic; node-level reconnectNow
strand: live->drop->reconnecting->restart-same-port->live). specs/75. README status
refreshed; PLAYTEST §6 items added.

Gate: npm test -> 315/315; ./test.sh browser smoke (incl. strand) + 5 Luau gates green.

---

## marker-0100 — Roblox AI opponents + ai_driver Luau twin + ai_1a gate (2026-08-11)

Ports the AI to Luau and adds named AI rivals to the Roblox host. Engine reducer/
hashes UNTOUCHED (AI is a command source), but the AI is now proven byte-identical
across languages.

NEW luau/ai_driver.luau mirrors engine/ai_driver.js exactly (lane-hold + symmetric
dodge, AI_SKILL tiers, tick-keyed throttle duty). NEW luau/ai-1a-check.luau runs the
JS AI golden race (seed 12345, course 1, 1 AI seat, medium) through the Luau reducer
+ chooseInput and asserts tick 307 + hash 43762b8616301876 — the 6th lune gate
(test.sh + luau_engine.test.js). First cross-language proof of the AI.

ROBLOX server GameServer.server.luau: each solo race now seats the player + AI_COUNT
(4) named rivals, lane-spread after createInitialState (Luau makeSeat centres all
seats; set laneX server-side). Each tick, after player input, every rival drives via
ai.chooseInput(...,AI_SKILL.medium) before advance. View gains a ghosts array
(same-segment rivals: seatId/name/carId/roadZ/laneX). CLIENT Render.luau: pooled
rival Parts (colour-cycled) + BillboardGui name tags, placed by depth from the view
ghosts.

specs/76. README (test 316, badge 6 gates, twin desc, roblox line). roblox/README
backlog + PLAYTEST §10 updated.

Gate: lune ai-1a matches JS; npm test -> 316/316; ./test.sh 6 Luau gates + browser
smoke green; rojo build valid.

---

## marker-0101 — Roblox varied AI field (2026-08-11)

Server-only (roblox/src/server), no engine/JS/Luau change. The 4 Roblox rivals now
draw from a hard/medium/medium/easy skill spread (AI_SKILLS indexed per rival) via
the proven ai_driver AI_SKILL tiers, so they separate into a race instead of a
uniform pack. Gate: rojo build valid; npm test 316/316 unaffected.

---

## marker-0102 — Roblox art pass phase 1: sunset sky + biome ground (2026-08-11)

Roblox-only presentation (roblox/src/client/Render.luau), no engine/JS/Luau change.
Art pass is procedural-only + phased + sunset (user decisions). Phase 1 of 3.

Render.setupLighting (one-time): warm dusk ClockTime 17.3 + orange Atmosphere
(density/haze/decay) + warm ambient + ColorCorrection tint + fog (FogStart 340,
FogEnd 720 = N*STRIP_LEN) so the treadmill draw distance fades into the horizon. No
textures. NEW biome ground: a Grass-material plane under the road recoloured each
view to the current segment's scenerySet palette — reads the SAME data/scenery.json
the browser uses (mounted as GameData.scenery; themeFor + hexToColor3). Snaps at
segment boundaries. specs/77 (documents all 3 phases; phase 1 done).

Gate: rojo build valid (scenery mounts, ground+lighting apply); npm test 316/316;
6 Luau gates untouched.

---

## marker-0103 — Roblox art pass phase 2: props + road-surface speed (2026-08-11)

Roblox-only presentation (Render.luau), no engine/JS/Luau change. Phase 2 of 3.
(1) Scrolling asphalt BANDS: strip colour alternates by floor(roadZ/ROAD_UNIT)+k
parity so the surface flows with speed. (2) Centre-line DASHES: pool of 28 white
dashes at DASH_SPACING (3 units), offset by roadZ%spacing so they scroll+recycle
(clearest speed cue). (3) Roadside PROPS: pool of 24 biome-tinted foliage balls +
grey rocks at PROP_SPACING (6 units) just off each shoulder; side/type keyed to the
absolute world slot so a prop is stable as it approaches (no jitter); foliage colour
derived from the biome ground. Deferred: curve-following per-biome side ground +
richer multi-part trees. specs/77 (phase 2 done).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0104 — Roblox art pass phase 3: procedural car models (2026-08-11)

Roblox-only presentation (Render.luau), no engine/JS/Luau change. Phase 3 of 3 (art
pass complete). Replaces the placeholder boxes with low-poly car RIGS: makeCarRig
builds body + darker rearward cabin + 4 dark wheel cylinders, each a Part at a fixed
LOCAL offset; placeCar(rig, cf) sets every part CFrame = cf*offset (no Model/pivot
magic — can't mis-pivot); setCarShown toggles a rig. Player + the 8 rival pool use
rigs (rivals keep the name-tag Billboard on the body, colour-cycled; player body
tints cyan/white for boost/crash). Camera follows carRig.body. Traffic stays as
boxes (perf). specs/77 (all 3 phases done). Deferred refinements: wedge nose/lights,
traffic-as-cars, per-biome car variety.

Gate: no leftover bare car./ghosts[] refs; rojo build valid; npm test 316/316; 6
Luau gates untouched.

---

## marker-0105 — Roblox art refinement: match the browser look (2026-08-11)

Roblox-only presentation (Render.luau), no engine/JS/Luau change. From a browser-vs-
Roblox screenshot comparison (user: procedural gradient sky + per-biome trees).
Sky: static SKY_BANDS backdrop (indigo->purple->magenta->orange) far ahead — camera
barely moves (treadmill) so a fixed wall reads as the sky; ground occludes its lower
half. Lighting toned down (Brightness 2.4->1.7, saturation up) so the red car stops
washing to pink; light haze, road end faded manually (far strips). Ground raised to
meet the road (kills the dark gap) + brighter flat biome colour. Red/white rumble
kerbs (rumbleL/R pools, alternating per strip) + bold YELLOW centre dashes. Per-biome
trees: palm (tall trunk + wide fronds) / fir (short trunk + tall foliage) / bush +
rocks, each a trunk+canopy rig from scenerySet. Cars: windshield + soft shadow +
lowered onto the road. HUD matches browser: TIME big centre, STAGE bottom-left cyan
(client stage map), SPEED bottom-right. specs/77 (refinement section). Deferred:
side water/sand, billboards, richer fronds, traffic-as-cars.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched. UNTESTED in Studio
(user to screenshot for tuning).

---

## marker-0106 — Roblox art fixes: road-to-bottom, traffic visibility, canopies (2026-08-11)

Roblox-only (Render.luau), no engine/JS/Luau change. From playtest screenshot-2.
(1) ROAD TO BOTTOM: ZSHIFT (14 studs) pushes the whole road (strips/rumble/dashes/
props/traffic/ghosts/pads) toward the camera so it reaches the bottom of the screen
behind the car, instead of starting at the car's depth. (2) TRAFFIC VISIBILITY: the
pool rendered an arbitrary 14 same-segment cars in server order, so on course-4's
huge first segment the NEAREST car (the one you hit) was often invisible ("you just
stop"). Now sorts nearest-first within the draw distance and renders the closest 14
— this also explains the white "flicker" (the engine crash-flash firing on unseen
traffic). (3) BIGGER canopies (palm 30-wide fronds, fir 26 tall, bush 17, rock 11).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0107 — Roblox art features: side ground, billboards, palm fronds, traffic-as-cars (2026-08-11)

Roblox-only (Render.luau), no engine/JS/Luau change. Clears the deferred art list.
(1) PER-BIOME SIDE GROUND: sideL/sideR strip pools coloured by theme.sideLeft/
sideRight (water/sand), following the curve, shown only where the biome defines them.
(2) BILLBOARDS: a sparse signs pool (post + camera-facing panel), placed further out
than the trees. (3) RICHER PALM FRONDS: a second offset crown layer (frond Ball) on
palm props. (4) TRAFFIC-AS-CARS: the traffic pool is now makeCarRig rigs coloured by
kind (blue trucks/buses, orange motorcycle, green sedan), positioned via placeCar/
setCarShown. specs/77. Still deferred: state interpolation, per-biome car variety.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0108 — Roblox state interpolation (smooth 20Hz->60fps) (2026-08-11)

Roblox-only (Render.luau + Main.client.luau), no engine/JS/Luau change. The server
view arrives at 20 Hz; the world stepped visibly. Refactor: the big render body is
now a local renderWorld(rz, laneX, view); Render.update(view) just stores the latest
view + a drift correction; NEW Render.step(dt) runs each RenderStepped (~60 fps),
EXTRAPOLATING renderRoadZ by speed*20*dt (engine advances roadZ by speed/tick) and
easing renderLaneX toward the view, then calls renderWorld. roadZ resets per segment,
so on a segmentId change the interpolator SNAPS (no backward jump). Main's
RenderStepped now calls Render.step(dt) + camera. Everything (road scroll, car,
traffic, rivals) now moves at 60 fps.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0109 — Roblox race framing (countdown + finish summary) (2026-08-11)

Roblox host (GameServer.server.luau + Render.luau), no engine/JS/Luau change. The
server session gains a phase machine: countdown (60t=3s, sim frozen at the line) ->
racing -> summary (100t=5s finish/time-up hold) -> fresh race. buildView carries
phase + countdown secs + restartIn. Client banner shows the 3-2-1 count, a brief GO!
(client edge on countdown>0->0), then "FINISH!/TIME UP  new race in Ns". Input is
naturally frozen during countdown (server only applies it in the racing phase) so
there's no lurch at GO.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0110 — Roblox real-player multiplayer (shared race) (2026-08-11)

Roblox host rewrite (GameServer.server.luau), no engine/JS/Luau change, no client
change (the client already renders ghosts by name). Was one solo race per player;
now ONE SHARED race of a fixed SEATS=6 field. Players take over AI seats on join
(drop-in at the AI's current position) and a seat reverts to AI on leave — so no
mid-race seat insertion (the Luau createInitialState fixes seats up front). Each
client gets a view centred on its own seat with the others (players + AI) as
ghosts (real player DisplayName vs AI_NAMES). Shared phase machine (countdown/
racing/summary); race ends when ALL seats are done. Field full (>6) => spectate
seat 1. inputBySeat/forkBySeat keyed by seat; PlayerAdded assignSeat, PlayerRemoving
frees it.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0111 — Roblox mobile touch controls (2026-08-11)

Roblox client (Main.client.luau), no engine/JS/Luau change. computeIntent now MERGES
keyboard + touch (either works). On touch devices (UIS.TouchEnabled) a ScreenGui of
hold-buttons is built: ◄ ► steer (bottom-left, ±256), ▲ gas / ▼ brake (bottom-right),
Q/E fork (top corners). MouseButton1Down/Up set the touch.{steer,accel,brake} state
and fire on change; fork buttons FireServer on press. Desktop keyboard path
unchanged.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0112 — Roblox boost VFX (2026-08-11)

Roblox client (Render.luau), no engine/JS/Luau change. A cyan ParticleEmitter is
parented to the player car body, enabled while seat.boostTicks>0 (in addition to the
existing cyan body tint), plus a camera FOV kick (70->82, eased) for the sense of
speed. Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0113 — Roblox per-biome car variety (2026-08-11)

Roblox host+client, no engine/JS/Luau change. Server adds the traffic id to the view
(stable per-car identity). Client CAR_PALETTE (8 vivid liveries); rivals + traffic
pick a colour by identity shifted by the segment's scenerySet, so the field looks
varied within a biome AND changes across biomes. Player stays red (identity).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0114 — Roblox end-of-race leaderboard (2026-08-11)

Roblox host+client, no engine/JS/Luau change. Server computes standings when the
shared race ends (computeStandings: finishers by finishTicks asc, then non-finishers
by progress via a server stageIndexOf map) and sends a formatted standings list
(rank/name/result/isSelf) in the view during summary. Client shows a RESULTS panel
listing rank + name + result (finish time or "Stage N"), the viewer's row
highlighted. Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0115 — Roblox car + course select (2026-08-11)

Roblox host+client, no engine/JS/Luau change. Server: prefCarByPlayer (per-player
car, applied to the seat now + at each fresh race) + roomCourseId (shared course,
applied at the next freshRoom); input handler takes {select="car",carId}/{select=
"course",courseId}; view carries courseId + the seat's car. Client: a top-left
◄ CAR N ► / ◄ COURSE ► selector (cycle buttons), synced from the first view; the HUD
stage map (stageOf/STAGE_TOTAL) is now rebuildable and refreshes when the room's
courseId changes. Completes the Roblox backlog batch (lobby/select + variety + VFX +
leaderboard).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0116 — Roblox ready-up lobby phase (2026-08-11)

Roblox host+client, no engine/JS/Luau change. New room phase "lobby" (LOBBY_TICKS=15s)
between races: freshRoom now enters lobby (fresh race frozen at the line); it advances
to countdown when ALL present players are ready OR the timer expires. readyByPlayer +
{select="ready"} message; PlayerRemoving clears ready+pref. View carries phase/lobbyIn/
ready/readyCount/playerCount. Client shows a "GET READY  Ns  X/Y ready" banner + a
READY button (visible only in lobby, until you've readied).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0117 — Roblox per-biome car shapes (2026-08-11)

Roblox client (Render.luau), no engine/JS/Luau change. setCarStyle resizes a rig's
body+cabin (and cabin offset) into distinct silhouettes (STYLES sport/suv/compact/
truck/bus/bike), only when the style key changes (cheap). Traffic gets a shape by
KIND (sedan/truck/bus/bike); rivals a shape by (seatId+biome)%3 so silhouettes vary
per car AND per biome; player is sport. Combined with the 0113 livery palette the
field now varies in shape + colour.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0118 — Roblox richer audio (event SFX) (2026-08-11)

Roblox client (Render.luau), no engine/JS/Luau change. Roblox has no procedural
synthesis, so uses BUNDLED rbxasset sounds (not marketplace assets): one
electronicpingshort re-pitched for checkpoint (1.4) / countdown beeps (1.0) / GO
(1.9) / finish (1.75), uuhhh for crash, action_jump for boost. Edges detected in
renderWorld (crash/boost/timer-bump/finish), gated to the racing phase so a
fresh-race timer reset can't fire a false checkpoint. NOTE: rbxasset SoundIds may
need swapping to ones that exist / preferred assets (Play is harmless if an id is
missing).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0119 — Roblox points carried across races (2026-08-11)

Roblox host+client, no engine/JS/Luau change. Server scans st.events after each
advance and awards the controlling player points (checkpoint +100, finish +1000,
collision -30, floored at 0) into pointsByPlayer, which is NOT reset by freshRoom
(carries across races) and cleared on leave. View carries points; client HUD shows a
"SCORE N" label top-right.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0120 — Roblox all-time leaderboard (DataStore) (2026-08-11)

Roblox host+client, no engine/JS/Luau change. Server: DataStoreService (all calls
pcall-guarded -> degrades to in-session-only without API access). allTimeBoard (top
10 {name,points}) loaded from the "top" key at boot; updateBoard merges a player and
saves; personal points loaded on join (p_<userId>) so they carry across SESSIONS,
banked into the board on race-end + on leave. View carries allTime during lobby/
summary. Client: the leaderboard panel shows ALL-TIME (rank/name/points) during the
lobby and RESULTS during the summary; READY button moved below it. Completes the
Roblox backlog batch.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

## marker-0121 — Roblox fix: traffic missing from view (2026-08-12)

Roblox host+client. buildViewFor built the same-segment traffic list but never put
it in the returned view, so view.traffic was nil and Render's ipairs(view.traffic)
threw every RenderStepped frame. Added traffic to the view; client loop guarded with
`or {}`.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0122 — Roblox playtest polish: sun/horizon, cars, terrain, time-up (2026-08-12)

Roblox presentation/host only. (1) Setting-sun neon disc + fixed the flickering
horizon "block" (ground slab overlapped the sky wall — ground now ends z~-1410, in
front of the wall at -1500). (2) Cars less boxy: sloped hood/boot wedges, neon
head/tail-lights, hubcaps, spoiler. (3) Per-biome surface materials (sand/sandstone/
concrete/ground/snow/grass) + always-on textured side verges (water where the biome
has it). (4) Per-player time-up: your finish/timeout ends YOUR race immediately with
a live score panel + SPECTATE the leader, instead of freezing at 0; reward is
stages-only (+100/checkpoint, no finish bonus / no collision penalty).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0123 — Roblox full-width horizon, sports-car rigs, grace-stop (2026-08-12)

Roblox presentation/host only. (1) Replaced the central circular sun halos with
full-width (9000) neon glow bands so the sunset colour spans the whole horizon. (2)
Rebuilt makeCarRig as a sculpted ~24-part sports coupe (long hood, raked screen,
fastback, haunches, splitter/diffuser, skirts, wing, light bars, hubcaps) with 3
proportion variants baked per rig; setCarStyle is now a no-op; per-part shown-
transparency keeps glass/shadow/neon right on pooled cars. (3) Grace-stop: when every
human seat is done, end the race within 5 s and mark still-running AI cars STOPPED.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0124 — Roblox polish: whole-car tint + spectate name (2026-08-12)

Roblox presentation/host only. Player car tints its whole shell (hull+hood+haunches)
on boost/crash, not just the hull. Server sends the watched driver's name; banner
shows "SPECTATING <name>".

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0125 — Roblox race HUD: position + progress bar (2026-08-12)

Roblox presentation/host only. Server sends the player's live standings position and
field size; client HUD shows "P n/6" (gold when leading) and a top progress bar that
fills with stages cleared. Both hidden outside racing/race-over.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

## marker-0126 — Roblox dusk clouds (2026-08-12)

Roblox presentation only. A few flat, warm, semi-transparent cloud Parts high across
the sky backdrop (off-centre from the sun) for horizon depth. Static.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0127 — Roblox whole-shell car tint (2026-08-12)

Roblox presentation only. The sculpted rig bakes hood/haunches at creation colour but
render only recoloured the hull -> traffic/rival cars had a mismatched (yellow/base)
hood. Added tintCar() over rig.bodyParts, used for player/traffic/rival so each car is
one colour.

Gate: rojo build valid; 6 Luau gates untouched.

---

## marker-0128 — Roblox playtest: seats, trees, sunset width (2026-08-12)

Roblox presentation/host only. (1) Human seats fill from the CENTRE lane outwards
alternating L/R (SEAT_ORDER by |laneX|) instead of player 1 far-left. (2) Fuller tree
canopies (palm 52 / fir 46-tall / bush 34) + slimmer 1-stud trunks + bigger palm
fronds. (3) Sunset now spans full width: cut atmosphere haze (Density .28->.1, Haze
1.5->.3) + pushed fog back (End 2200->3600) so the backdrop stays saturated to the
screen edges instead of washing grey-blue; thickened the full-width warm glow bands.

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

---

## marker-0129 — Roblox pre-race selection screen (2026-08-12)

Roblox presentation only. Replaced the always-on top-left cycle UI with a CENTRED
lobby-only panel: step 1 SELECT TRACK (biome thumbnail + stylised road), step 2 SELECT
CAR (rotating 3D car in a ViewportFrame tinted to the pick), each with title + name +
arrows. NEXT track->car, START readies up, BACK returns to track. Shown only in the
lobby, hidden once ready/racing, resets to track step next race. Spectate button
reparented; readyBtn removed.

Gate: rojo build valid; 6 Luau gates untouched.

## marker-0130..0135 — Roblox playtest round (2026-08-12)

Roblox presentation/host only; engine untouched; rojo build valid each step; npm
test 316/316; 6 Luau gates untouched.

- 0130 fix GREEN-CAR bug (player car tinted by PLAYER_CAR_COLORS[view.car] not
  hard-coded red) + colour FLICKER (traffic/rival colour keyed on identity only, no
  longer shifts with the player's biome) + WIDER sunset (taller warm bands, 24000-wide
  backdrop, wider warm glow).
- 0131 selection FLOW now TRACK -> CAR -> READY (a race-start step where all humans
  press READY); BACK steps back; arrows only on the pick steps.
- 0132 BILLBOARDS: post moved BEHIND (z-1.6) + below the board (no more pole through
  the face); SurfaceGui text with cycling fake ads + a green "GO <PLAYER>!" board.
- 0133 varied TRAFFIC vehicles: makeVehicleRig sedan/estate/fast/bus/lorry/bike,
  pooled per type, assigned by kind+id; left-lane traffic faces the camera (ONCOMING),
  right-lane faces away (overtake). Cosmetic (engine traffic unchanged).
- 0134 accurate PRE-RACE preview car (ViewportFrame mirrors the in-race sculpted rig).
- 0135 top-down TRACK THUMBNAIL: walk the default path accumulating lateral curve
  (double integral) -> normalised polyline plotted as dots + start/finish markers.

## marker-0136 — Roblox: car detail + decorative oncoming traffic (2026-08-12)

Roblox presentation only. (1) Car detail: wing mirrors, hood vent, door creases, twin
exhaust tips on the sculpted rig (mirrored in the pre-race preview). (2) Oncoming:
engine traffic is SAME-direction (you overtake) so it faces away (reverted the
misleading left-lane facing); added a VISUAL-ONLY oncoming stream in the opposing
(left) lane — a pool of varied vehicles advanced toward the player in Render.step,
respawned far ahead once passed, facing the camera. Not collidable (engine untouched);
the real avoidable traffic stays the engine's.

Gate: rojo build valid; 6 Luau gates untouched.

---

## marker-0137 — Roblox: checkpoint/finish gantries + crash shake (2026-08-12)

Roblox presentation only. (1) Over-road gantries (posts + beam + lit sign) at upcoming
segment boundaries: green CHECKPOINT where seg.checkpointTicks>0, white FINISH where
nextSegment==-1; pool of 3, placed by scanning built strips. (2) Decaying crash camera
shake on the crash edge (same trigger as the crash SFX).

Gate: rojo build valid; npm test 316/316; 6 Luau gates untouched.

## marker-0138..0140 — Roblox sunset width/flicker + selection labels (2026-08-13)

Roblox presentation only; rojo build valid each step; 6 Luau gates untouched.

- 0138 FIX SUNSET WIDTH: root cause was Roblox clamping Part.Size to 2048 studs/axis,
  so the 9000/24000-wide backdrop was capped at 2048 and showed as a central rectangle.
  Backdrop bands + neon glow now TILED across five 2000-wide parts (10000 total). Layers
  z-separated (bands 0 / clouds +6 / glow +12 / sun +20 / cuts +24).
- 0139 selection labels: CONFIRM TRACK -> CONFIRM CAR -> RACE LINEUP (READY button).
- 0140 FIX SUNSET FLICKER: sky bands overlap in Y but sat at one depth -> overlap strips
  z-fought; stagger each band 0.6 studs further back.

## marker-0141 — Roblox car-select preview framing (2026-08-13)

Roblox presentation only. The ViewportFrame preview car was tiny at the default 70°
FOV; set the viewport camera to FieldOfView 40 and pull the orbit in (r 17->15, lower
eye) so the car fills the panel.

Gate: rojo build valid; 6 Luau gates untouched.

---

## docs — roblox-howto-and-gotchas.md (2026-08-13)

Added `roblox/roblox-howto-and-gotchas.md`: a Roblox-specific implementation guide
distilled from the whole host build — the 2048 Part.Size clamp (the sunset-width bug),
coplanar z-fight flicker, Rojo sync/reconnect + require() resolution, the determinism
boundary, treadmill/pooling patterns, WedgePart/Cylinder orientation, Neon/Atmosphere/
Fog behaviour, ViewportFrame/SurfaceGui/BillboardGui setup, input/camera, RemoteEvents
(the nil-field trap), DataStore pcall/API-access, audio, and misc. Also specs/78.

## marker-0142..0144 — Roblox: OrderedDataStore board + engine hum + minimap (2026-08-13)

Roblox presentation/host only; engine untouched; rojo build valid; npm test 316/316.

- 0142 all-time board via OrderedDataStore: userId->points via GetSortedAsync gives a
  TRUE server-wide top-10 (the old "top" key only reflected players this server saw);
  names resolved with GetNameFromUserIdAsync (cached). Plain store still carries
  personal points. pcall-guarded -> in-session fallback; warmed at boot + on bank.
- 0143 engine-hum audio: a looping Sound whose PlaybackSpeed + Volume rise with speed
  (extra pitch on boost), smoothed, silent off-track. BUNDLED placeholder SoundId
  (ENGINE_SOUND_ID) -> swap for a proper engine-loop asset for a nicer tone.
- 0144 race minimap: top-left panel draws the course top-down (double-integral curve
  walk + per-segment start-strip offsets) with a live player dot placed by segmentId +
  roadZ (stage-fraction fallback on fork branches). Rebuilt on course change; on-track only.

## marker-0145 — Roblox playtest fixes: sunset softness, car colour, road gap (2026-08-14)

Roblox presentation only; engine untouched; rojo build valid; npm test 316/316.

1. Sunset haze softened (playtest "CGA glare"): pastel SKY_BANDS + the glow layer
   switched from glaring Neon to faint SmoothPlastic pastel; softer sun/cut tones.
2. Player car holds its SELECTED colour steadily — dropped the boost-cyan / crash-white
   full recolour (it flipped between two colours on boost-pad-heavy course 4). Boost
   still shows via the particle trail + FOV kick; a crash is a brief light flash only.
3. FIX road vanishing in a turn near a stage end: buildStrips hit a fork/next of -1 and
   returned a SHORT strip array -> the road disappeared and cars appeared to drive on
   the terrain. Now it freezes the curve and lays straight strips to the horizon.

## marker-0146 — Browser traffic: varied shapes, sizes, sheen not box (2026-08-14)

Browser (Canvas) presentation only; engine untouched; npm test 316/316; browser smoke OK.
From browser playtest: (1) traffic was too large + all one "car" shape — the scale
normalised away sprite size and every kind used kind="car". New client-side trafficSprite
factory (kept OUT of the manifest, so no content-hash change): distinct shapes sedan/
estate/sport/lorry(truck)/bus/motorbike, sized per-type as a fraction of the road
half-width. Rival scale 0.62->0.36. (2) rival crash "white box" was a white bounding
RECT -> now a white SHEEN redrawn over the car's shape. (3) varied traffic via new
sprite kinds (bus/truck/estate/sport) + id-based car variants.

## marker-0147 — Roblox: halve oncoming stream + car-colour flicker (2026-08-14)

Roblox presentation only; rojo build ok. (1) ONC_N 8->4 (oncoming halved). (2) car-colour
flicker: crash tint was sustained over the 30-tick stun -> now a brief decaying white
flash on the impact edge only; base stays the selected colour.

## marker-0148 — Browser: no start-line checkpoint board + arcade initials (2026-08-15)

Browser presentation; npm test 317/317; browser smoke OK. (1) The checkpoint-standings
board fired for the checkpoint segment you START in (a stage-1 board before anyone had
raced) — prime selfLastCp to the spawn segment on the first update so only real crossings
fire (+updated fade test, +suppression test). (2) Arcade HIGH-SCORE initials: on a solo
race end that makes the top-10, an old-school 5-slot A-Z entry (◄►move ▲▼letter ENTER ok,
no typing) over the frozen scene, recorded under those initials. New client/initials_entry.js
+ input.js up/down menu-nav + main.js solo high-score routing.

## marker-0149 — Roblox: widen cars to the crash box (2026-08-15)

Roblox render only; rojo build ok. Crash triggers at CAR_WIDTH=200 (~11 studs) but cars
were ~6 wide -> crashed with a visible gap. Scale every car part's width + lateral offset
by CAR_WIDEN=1.5 in the shared add() of makeCarRig/makeVehicleRig + the preview, so the
visible car ~ the collision footprint. Engine/collision untouched.

## marker-0151 — slim crash hitbox (CAR_WIDTH 200->140) + narrow Roblox cars (2026-08-15)

Engine + Roblox. Playtest: widened Roblox cars (0149) too wide; user OK'd a slimmer
hitbox for both platforms. CAR_WIDTH 200->140 (shared/collision.js + luau twin) -> crash
box ~7.7 studs; Roblox CAR_WIDEN 1.5->1.16 (+ preview PBW) -> cars ~7.2 studs. CONSCIOUS
REPIN (only traffic-collision goldens moved): checkpoint_1a finalHash ed6b3a860eef6d4f;
physics_1a accel hashAtTick500 3b1c1589dbe16519, finishTick 450->395 (slimmer = fewer
crashes). collision/fork/boost/AI goldens UNCHANGED. npm test 317/317; 6 lune gates OK.

## marker-0152 — Roblox: hide lingering SurfaceGui text, smooth rivals, camera pans (2026-08-15)

Roblox render. (1) SurfaceGui text renders even on a transparent part -> hidden gantry/
billboard text hung (the "CHECKPOINT at the start"); toggle labels' Visible with the part.
(2) rivals "jigged" at the start (placed from 20 Hz view while the world scrolls at 60 fps)
-> ease each rival's rendered dz/laneX (snap on big jump). (3) road left the frame in a
sharp corner (camera looked straight) -> pan the camera toward the road's curve-ahead.

## marker-0153 — Roblox: checkpoint race list (2026-08-15)

Roblox host+client. On crossing a checkpoint, a board shows who leads + seconds behind.
Server records each seat's checkpoint-arrival tick (engine checkpoint events) and builds a
ranked gap list on the player's own crossing (gap=(arrival-leader)/20s), sent ~5 s in the
view. Client shows a CHECKPOINT board during racing (LEADER / +X.Xs).

## marker-0154 — Roblox: sky-follow (fix every-race sunset warm-up) (2026-08-15)

The sunset faded in ~2 s at every race start (edge backdrop tiles lazy-rendered; a render
hitch cleared it for the session — signature of Roblox lazy-deferring large static distant
parts). Now every sky part is repositioned each frame to track the view (offset by look.X),
so Roblox keeps them in the active render set (no lazy defer). Bonus: the sunset tracks the
heading. Presentation only.

## marker-0155 — Roblox: road-in-corner + sky width (revert pan) (2026-08-15)

Screenshot-12: the 0152 camera pan overshot — swung the near road + car off-screen in a
corner (terrain-only view) and the rotated camera exposed the flat sky-wall edge. Reverted
to a straight chase camera; keep the road in frame via CURVE_DAMP=0.62 in buildStrips
(scale the road's lateral curve, everything placed by curveX stays consistent); widened
the sky to 7×2000 tiles (14000). Sky-follow retained (warm-up fix), offsets by look.X.

## marker-0156 — deploy 404 fix: absolute entry-script path (2026-08-16)

Deployed game was dead: `GET /` served index.html but the URL stays `/`, so its relative
`./main.js` resolved to `/main.js` (not a served dir) → 404 → module graph never booted.
Fixed by making the entry reference absolute: `<script src="/client/main.js">` (main.js's
own `../shared/...` imports resolve from `/client/main.js` regardless of document URL).
Guards: `test/serve_static.test.js` now resolves the served page's `<script src>` against
`/` and asserts it is 200 JS (runs in `npm test`); `test/browser_smoke.mjs` boots the real
`/` entry. Same family as the marker-0019 served-dirs gotcha. Presentation/serving only.

## marker-0157 — mobile controls: steering wheel + set-speed lever + touch initials (2026-08-17)

Mobile playtest: touch controls reworked (touch only; keyboard/engine untouched). New
`client/touch_controls.js`: a STEERING WHEEL bottom-centre (top half visible, drag L/R =
steer, springs back), a right-side SET-SPEED LEVER (knob = a cruise speed the car holds so
no button-holding — `readTouchInput` reports 0..1 `throttleFrac`, `main.js` turns it into
accel/brake vs the live car speed with a `SPEED_SCALE/4` deadband; default full, gated on
`showTouch`), fork arrows unchanged. Initials entry gets touch: `tap()` + shared
`initialsLayout` — tap a slot to select, on-screen ▲ ▼ change its letter, ENTER advances
slot-by-slot and confirms after the 5th (new `"enter"` event; keyboard `"confirm"` still
finishes now). Tests: rewritten `touch_controls.test.js` + `initials_entry.test.js` (326
green); browser smoke OK. Spec: specs/79. Presentation only — no engine/fixture change.
