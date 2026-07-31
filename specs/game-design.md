Yes — the **Fireline Command stack is the better sibling to copy** for this OutRun-style racer because it has already solved the hard real-time parts: tick loop discipline, headless sim campaigns, WebSocket server pump, client smoke/perf tooling, fixed-point movement, deterministic AI/probes, and layer-gated development.

Below is a markdown-ready brief for a local coding ally.

### `OUTRUN_STACK_BRIEF.md`

# OutRun Turbo — Technical Brief for Local Coding Ally

*Design target: modern OutRun-style browser racer with classic checkpoint timer, branching point-to-point routes, 8-player drop-in multiplayer, ghost mode by default, optional same-segment collision, and a later Roblox/Luau port.*

## 1. Executive summary

Build this game as a **real-time sibling of Fireline Command**, not as a new experimental stack.

Use the proven shape:

- **JavaScript / Node.js / ESM**
- **No build step**
- **No framework**
- **Dependency-free `shared/` and `engine/`**
- **Node HTTP + `ws` server**
- **Canvas 2D renderer first**
- **Pure deterministic reducer**
- **Integer fixed-point math**
- **Server-authoritative multiplayer**
- **Fog/view-filtered transport**
- **Headless simulation and replay-first debugging**
- **Luau twin later, not rewrite**

The racer differs from Fireline in presentation and game feel, not in stack philosophy. The server still owns truth. The client still renders views. The engine still reduces deterministic commands. The tests still pin hashes. The renderer is where the OutRun magic lives.

## 2. Why Fireline Command is the right base

Fireline is more relevant than RetroMultiCiv because this racer is **real-time**.

RetroMultiCiv gives us the cross-platform deterministic reducer discipline. Fireline adds the production-proven parts we need most:

| Fireline practice | OutRun racer equivalent |
|---|---|
| Real-time server tick loop | 20 or 30 Hz authoritative race simulation |
| Fixed-point entity movement | Fixed-point car speed, road position, lane offset, steering |
| Server-authoritative commands | Input frames instead of RTS orders |
| Fog-filtered client views | Per-player race view with ghost-filtered rivals |
| AI sim campaigns | Bot drivers for soak, traffic testing, rubber-band tuning |
| Mirror/factionswap fairness tools | Left/right route fairness, fork fairness, traffic-seed fairness |
| Client smoke + UI acceptance | Canvas boot, input works, HUD updates, join works |
| Native GPU perf lane | Browser FPS and mobile draw-strip budget validation |
| Event census | Check that forks, traffic, collisions, checkpoints, timeout, finish all fire |
| Replay/hash debugging | Race replay as bug report |

The key adaptation: Fireline commands are strategic orders; this game’s commands are **input frames**.

```js
{
  type: "input",
  seatId: 2,
  tick: 18420,
  steer: -1,
  accel: 1,
  brake: 0,
  shift: 0
}
```

The reducer still owns everything.

## 3. Core architecture

```text
data/
  cars.json
  roads.json
  traffic.json
  scenery.json
  checkpoints.json

shared/
  fixed.js
  prng.js
  canonical.js
  statehash.js
  road_math.js
  commands.js
  view_filter.js

engine/
  reducer.js
  init.js
  car_physics.js
  road_progress.js
  timer.js
  traffic.js
  collision.js
  forks.js
  scoring.js
  snapshot.js
  copy_state.js
  invariants.js
  ai_driver.js

client/
  index.html
  main.js
  session_local.js
  session_remote.js
  input.js
  renderer_canvas.js
  road_renderer.js
  sprite_renderer.js
  hud.js
  audio.js
  touch_controls.js
  debug_overlay.js

server/
  server.js
  game_room.js
  protocol.js
  seats.js
  replay_store.js
  rate_limits.js
  master_index_client.js

test/
  reducer.test.js
  physics.test.js
  road_math.test.js
  checkpoint_fixture.test.js
  replay.test.js
  hash.test.js
  view_filter.test.js
  server_ws.test.js
  client_imports.test.js

debugging/
  sim_campaign_outroad.sh
  sim_race_systems.mjs
  dbg_collision.mjs
  dbg_checkpoint.mjs
  dbg_fork_fairness.mjs

tools/
  build_assets.mjs
  render_asset_strip.mjs
  sim_sweep.mjs
  analyze_sweep.py
  repin_fixture.mjs
  perf_native.ps1
```

## 4. Project rule: no clever new stack

Do not introduce React, Phaser, Pixi, Three.js, Colyseus, Matter.js, bundlers, TypeScript, decorators, ECS frameworks, or physics libraries in the first version.

The point of the first version is to prove:

1. The road feels good.
2. The checkpoint loop works.
3. The server can host 8 drop-in players.
4. The renderer works on desktop and mobile browsers.
5. The engine can be Luau-twinned later.

If the plain stack cannot carry the game, we need evidence from profiling, not preference.

## 5. Simulation model

The game simulation is a fixed-tick reducer.

Recommended server tick rate:

```text
20 Hz authoritative simulation
60 Hz client rendering
```

Reason:

- 20 Hz is enough for arcade racing state authority.
- It reduces WebSocket traffic.
- It is easier to replay, hash, and Luau-port.
- Client-side prediction and interpolation hide the lower sim rate.

The reducer signature:

```js
apply(state, command) -> state
```

For local/headless tests, one tick is explicit:

```js
state = apply(state, {
  type: "input",
  seatId: 1,
  tick: state.tick,
  steer: 0,
  accel: 1,
  brake: 0,
  shift: 0
});
```

The server queues the latest input frame per player and applies one frame per tick.

## 6. State shape

The state should be boring, serializable, hashable, and Luau-portable.

Example draft:

```js
{
  version: 1,
  tick: 0,
  seed: 12345,
  rng: 2463534242,

  race: {
    status: 1,
    courseId: 1,
    maxSeats: 8,
    checkpointIndex: 0,
    finishedCount: 0
  },

  seats: [
    {
      id: 1,
      active: 1,
      connected: 1,
      carId: 1,
      pathCode: 0,
      segmentId: 1,
      strip: 0,
      roadZ: 0,
      laneX: 0,
      speed: 0,
      accelHeld: 0,
      brakeHeld: 0,
      steerHeld: 0,
      gear: 1,
      heading: 0,
      drift: 0,
      checkpointTicks: 1800,
      score: 0,
      crashedTicks: 0,
      finishTicks: -1
    }
  ],

  traffic: [
    {
      id: 1,
      segmentId: 1,
      roadZ: 8000,
      laneX: -256,
      speed: 1200,
      kind: 1
    }
  ],

  events: []
}
```

Use arrays and integer IDs. Avoid object maps in engine state if the Luau twin will need line-shaped translation.

## 7. Fixed-point conventions

Pick one convention early and pin it.

Suggested:

```text
ROAD_UNIT = 256
LANE_WIDTH = 256
SPEED_SCALE = 256
TICK_HZ = 20
```

Examples:

```js
// lane centre positions
LEFT_LANE = -256
CENTER_LANE = 0
RIGHT_LANE = 256

// road progress
roadZ += speedPerTick

// speed
speed = 1800 // fixed-point internal speed, not km/h directly
```

Rules:

- No floats in `shared/` or `engine/`.
- No `Math.sin`, `Math.cos`, or arbitrary trig in gameplay logic.
- If curves need tables, precompute integer lookup tables in data.
- Use named helpers for division and interpolation.
- Signed division must be explicit. Do not rely on JS/Luau disagreement.

## 8. Road model

The road is not a 3D mesh. It is a sequence of pseudo-3D strips.

Each course is a graph of road segments.

```json
{
  "courses": [
    {
      "id": 1,
      "nameKey": "course.sunset_coast",
      "startSegment": 1
    }
  ],
  "segments": [
    {
      "id": 1,
      "stripCount": 600,
      "checkpointTicks": 0,
      "next": 2,
      "forkLeft": -1,
      "forkRight": -1,
      "curveProfile": [0, 0, 1, 2, 3, 2, 1, 0],
      "hillProfile": [0, 0, 0, 1, 2, 1, 0, 0],
      "trafficSeed": 101,
      "scenerySet": 1
    },
    {
      "id": 5,
      "stripCount": 400,
      "checkpointTicks": 600,
      "next": -1,
      "forkLeft": 6,
      "forkRight": 7,
      "curveProfile": [0],
      "hillProfile": [0],
      "trafficSeed": 505,
      "scenerySet": 2
    }
  ]
}
```

Forks should be deterministic choices in the reducer, not client-side routing.

A player approaching a fork sends:

```js
{ type: "forkChoice", seatId: 1, tick: 3000, choice: -1 }
```

Where:

```text
-1 = left
 1 = right
```

If no choice is received, use deterministic default based on current lane or route rule.

## 9. Renderer choice

Use **Canvas 2D pseudo-3D** first.

Do not start with full WebGL unless Canvas 2D cannot hit perf. Canvas is easier to debug, easier to port conceptually to Roblox UI strips, and authentic to the OutRun feel.

Renderer responsibilities:

- Draw sky/background.
- Draw road strips back-to-front.
- Draw lane markers.
- Draw scenery sprites.
- Draw traffic cars.
- Draw ghost cars.
- Draw local car.
- Draw HUD.

Renderer must not own gameplay decisions.

Good split:

```text
engine/road_progress.js     decides where the car is
shared/road_math.js         exposes projection helpers
client/road_renderer.js     draws projected strips
client/sprite_renderer.js   draws scaled sprites
```

## 10. Multiplayer model

Target:

```text
Up to 8 players per race room
Drop-in/drop-out
Ghosts by default
Collision only when players share the same segment/path branch
```

### Server authority

The server owns:

- Car position
- Speed
- Timer
- Traffic
- Collision
- Fork choice acceptance
- Race finish
- Scoring

The client sends only input.

### Transport

Use `ws`, same as Fireline.

Client to server:

```js
{
  type: "input",
  seq: 123,
  tick: 4567,
  steer: -1,
  accel: 1,
  brake: 0,
  shift: 0
}
```

Server to client:

```js
{
  type: "view",
  serverTick: 4568,
  self: { ... },
  ghosts: [ ... ],
  traffic: [ ... ],
  events: [ ... ],
  hash: "..."
}
```

### Ghost filtering

A player does not need full rival state.

Send only:

```js
{
  seatId: 3,
  segmentId: 12,
  roadZ: 20224,
  laneX: -180,
  speed: 1600,
  carId: 2,
  collisionActive: 1
}
```

`collisionActive` is `1` only when the rival is in the same segment/path context and within the collision window.

## 11. Collision model

Keep collision simple and arcade-like.

Recommended first version:

- Traffic collision: slows player and triggers crash stun.
- Rival collision: optional, only same segment, soft bump.
- No pile-up physics.
- No rotational rigid bodies.
- No physics engine.

Example collision rule:

```text
If abs(a.roadZ - b.roadZ) < CAR_LENGTH
and abs(a.laneX - b.laneX) < CAR_WIDTH
then apply bump/crash response.
```

For ghost mode:

```text
Always render ghosts.
Only apply collision when room setting `rivalCollision = 1`
and both players are on the same segment/path.
```

## 12. Checkpoint timer

Use classic arcade checkpoint extension.

Rules:

- Race starts with initial time.
- Passing a checkpoint adds time.
- Timer reaches zero -> timeout.
- Finish before timeout -> finished.
- Multiplayer finish order uses finish tick.

Do not reset timer at checkpoint unless design later demands it.

Suggested:

```text
startTimeTicks = 75 * 20
checkpointBonusTicks = 30 * 20
```

Store actual values in `data/checkpoints.json`, not code.

## 13. Game feel priorities

The game lives or dies by feel. The first milestone should not chase content volume. It should chase driving feel.

Priority order:

1. Road speed sensation.
2. Smooth curve readability.
3. Car steering response.
4. Hills and horizon motion.
5. Traffic tension.
6. Checkpoint pressure.
7. Music/audio vibe.
8. Multiplayer ghosts.

Physics should be arcade, not realistic. Use car data to create feel, but do not simulate a real drivetrain unless needed.

Example car parameters:

```json
{
  "cars": [
    {
      "id": 1,
      "nameKey": "car.red_sprint",
      "maxSpeed": 2400,
      "accel": 22,
      "brake": 45,
      "offroadDrag": 60,
      "steerLow": 18,
      "steerHigh": 9,
      "driftRecovery": 12
    }
  ]
}
```

## 14. AI drivers

Copy Fireline’s lesson: AI is not just a feature; it is a measurement instrument.

Use deterministic AI drivers for:

- Single-player traffic/rivals.
- Empty multiplayer seats if desired.
- Sim sweeps.
- Checkpoint tuning.
- Fork fairness.
- Collision testing.
- Replay reproduction.

AI input is just another command source.

```js
command = aiDriverChooseInput(state, seatId);
state = apply(state, command);
```

The AI must be deterministic and seed-pinned.

## 15. Testing strategy

Copy Fireline’s layered gates.

### 15.1 Unit tests

Use `node --test`.

Test:

- Fixed-point helpers.
- PRNG vectors.
- Road segment progression.
- Fork choice.
- Checkpoint timer.
- Collision windows.
- Traffic spawning.
- Copy state.
- Hash state.
- View filtering.

### 15.2 Fixture test

Create a small pinned fixture similar to Fireline’s 1A.

For this game, call it:

```text
checkpoint_1a
```

It should pin:

- Initial seed.
- 1 car.
- 1 simple road.
- 40–100 input frames.
- Every intermediate hash or every 10th hash.
- Event list.

Repin tool:

```bash
node tools/repin_checkpoint_1a.mjs "reason"
```

Same doctrine:

- Repin is a conscious act.
- Event drift aborts unless explicitly accepted.
- Routine tick state changes should be silent.

### 15.3 Scenario tests

Use JSON scenario files:

```json
{
  "name": "fork_left_checkpoint",
  "seed": 1001,
  "commands": [
    { "tick": 1, "type": "input", "seatId": 1, "steer": 0, "accel": 1, "brake": 0, "shift": 0 },
    { "tick": 120, "type": "forkChoice", "seatId": 1, "choice": -1 }
  ],
  "expectedFinalHash": "..."
}
```

These become Luau acceptance fixtures later.

### 15.4 Sim campaign

Create the racer equivalent of Fireline’s sim gate:

```bash
bash debugging/sim_campaign_outrun.sh
```

Suggested default:

```text
5 pinned seeds
8 AI drivers
3 route profiles
10–15 minutes simulated each
event census printed
```

The 5-seed gate answers: “Do systems fire?”

It does not answer: “Is the game balanced?”

### 15.5 Sweep battery

Use `tools/sim_sweep.mjs N`.

CSV columns should include:

- seed
- courseId
- winnerSeat
- finishCount
- timeoutCount
- averageFinishTicks
- checkpointFailSegment
- collisionsTraffic
- collisionsRival
- forkLeftCount
- forkRightCount
- bestRoute
- worstRoute
- leadChanges
- nearMisses
- maxSpeedReached
- offroadTicks
- resultHash

For balance/tuning, use 300+ runs, not 5.

## 16. Fairness instruments for a racer

Fireline has mirror and factionswap. This racer needs similar fairness tools.

### 16.1 Route mirror

If a course has left/right branches, mirrored route geometry should produce equivalent difficulty unless intentionally asymmetric.

Need tools:

```bash
MIRROR=1 node tools/sim_sweep.mjs 300
```

Measures whether left/right geometry is biased.

### 16.2 Car swap

Equivalent to factionswap.

```bash
CARSET=baseline node tools/sim_sweep.mjs 300
CAR_A=1 CAR_B=2 node tools/sim_sweep.mjs 300
```

Separates car-stat strength from route/seat advantage.

### 16.3 Traffic seed swap

Traffic can accidentally favor one branch.

```bash
TRAFFICSWAP=1 node tools/sim_sweep.mjs 300
```

### 16.4 Seat order bias

Because multiplayer is real-time, seat iteration order can create bugs.

Tests must verify:

- Seat 1 does not get collision priority forever.
- Tie-breaking is deterministic but fair.
- Same tick finish ties are handled explicitly.

## 17. Client tooling

Copy Fireline’s client tooling almost directly.

Use Playwright for:

- `client_smoke.mjs`: page boots, no console errors, canvas appears, local race reaches tick > 0.
- `ui_acceptance.mjs`: buttons work, keybinds work, touch controls fire commands, join flow works.
- `perf_smoke.mjs`: road renderer stays within budget under synthetic load.

Important Fireline lesson applies:

```text
WSL Playwright / SwiftShader is correctness-only.
Native GPU perf must run on Windows proper.
```

For this racer, native perf is not optional. The whole game is renderer feel.

## 18. Asset pipeline

Start procedural and strip-based.

Use:

```text
tools/build_assets.mjs
tools/render_asset_strip.mjs
```

Bake:

- Player car rotations / scale variants if needed.
- Traffic cars.
- Palm trees.
- Signs.
- Roadside props.
- HUD digits/icons.

Pin the asset strip width by test, exactly as Fireline does, so manifest changes cannot silently shift every sprite.

Do not hand-manage sprite coordinates in gameplay code.

## 19. Audio

Audio is not gameplay-authoritative. Keep it client-side.

But selection state can be deterministic if needed:

```js
{
  type: "musicSelect",
  seatId: 1,
  trackId: 2
}
```

Classic OutRun-style feature:

- Track select before race.
- Music continues during race.
- Final score / results track.

Use Web Audio or plain `HTMLAudioElement` first. Do not overbuild.

## 20. Roblox/Luau port plan

The Roblox port should be a **twin**, not a creative rewrite.

Port order:

1. `shared/prng.js`
2. `shared/fixed.js`
3. `shared/canonical.js`
4. `shared/statehash.js`
5. `engine/init.js`
6. `engine/car_physics.js`
7. `engine/road_progress.js`
8. `engine/timer.js`
9. `engine/forks.js`
10. `engine/traffic.js`
11. `engine/collision.js`
12. `engine/reducer.js`

Use the same JSON scenarios as cross-language contracts.

Roblox rendering options:

### First Roblox renderer

Use `ScreenGui` road strips:

- One `Frame` per road strip.
- Width and X offset derived from the same projection math.
- Scenery as `ImageLabel`.
- Cars as `ImageLabel`.

This is closer to Canvas 2D and easier to verify.

### Later Roblox renderer

If needed, use Parts/MeshParts for a stylized 3D road. But do not start there. It risks becoming a second game.

## 21. Important differences from Fireline

### 21.1 Renderer is more central

In Fireline, gameplay readability is high-value, but in this racer the renderer is the game feel. The road renderer deserves first-class tests, screenshots, and perf gates.

### 21.2 Client prediction matters more

Fireline can tolerate slightly delayed strategic feedback. A racer cannot. The client should predict local car movement immediately, then reconcile with server snapshots.

Prediction must be client-only. The server remains authoritative.

### 21.3 Hashing every rendered frame is unnecessary

Hash simulation ticks, checkpoint boundaries, replay chunks, and server snapshots. Do not make the renderer part of the deterministic contract.

### 21.4 AI is simpler but still critical

AI driving is less strategic than RTS AI, but it is still the core tuning instrument.

### 21.5 Balance is route feel, not only win rate

Sweeps should measure:

- Where players timeout.
- Which branch is easier.
- Where crashes cluster.
- Whether curves are readable.
- Whether traffic density creates unfair chokepoints.
- Whether optional collision causes griefing or fun.

## 22. Development workflow

Use Fireline slice discipline.

Each slice should have:

1. Named `slice-...` commit prefix.
2. Design note in `dev-prompts.md` or `specs/`.
3. Tests first where possible.
4. Unit suite green.
5. Relevant layer gate green.
6. Dev-log entry.
7. Replay or screenshot artifact if visual/gameplay.

Suggested first slices:

```text
slice-001-project-skeleton
slice-002-prng-fixed-hash
slice-003-road-data-loader
slice-004-single-car-physics
slice-005-canvas-road-renderer
slice-006-checkpoint-timer
slice-007-traffic-spawn
slice-008-local-race-loop
slice-009-node-ws-room
slice-010-remote-session-seam
slice-011-ghost-players
slice-012-same-segment-collision
slice-013-replay-dump-load
slice-014-ai-driver
slice-015-sim-campaign
slice-016-client-smoke
slice-017-mobile-touch-controls
slice-018-asset-strip-pipeline
slice-019-roblox-prng-hash-twin
```

## 23. First playable milestone

Do not aim for “full game” first. Aim for this:

### Milestone 1: Solo checkpoint run

- One course.
- One car.
- Canvas pseudo-3D road.
- Accel/brake/steer.
- Timer.
- One checkpoint.
- Timeout.
- Finish.
- Replay dump.
- Golden hash fixture.

### Milestone 2: Server room

- Node server serves static client.
- WebSocket join.
- One race room.
- Server-authoritative tick.
- Client sends input.
- Client receives view.
- Reconnect basic.

### Milestone 3: 8-player ghost race

- 8 seats.
- Drop-in while race active.
- Ghost rendering.
- Finish ordering.
- Server replay.

### Milestone 4: Collision and traffic

- Traffic cars.
- Traffic collision.
- Rival collision toggle.
- Collision event census.
- AI sim campaign.

### Milestone 5: Content and feel

- Branching forks.
- Multiple checkpoint segments.
- Better scenery.
- Music select.
- Mobile controls.
- Perf pass.

## 24. Gotcha list for this project

Carry Fireline’s gotchas forward, with racer-specific additions.

1. Probe vs sweep disagree → check config plumbing first.
2. New positional state → copyState, hashState, view filter, replay, Luau twin.
3. New route/fork state → mirror transform and route fairness tools.
4. Seat iteration order can create multiplayer bias.
5. Do not tune on 5 seeds.
6. Telemetry must record failure, not just success.
7. Event probes must verify field names against reducer events.
8. Renderer FPS in SwiftShader is not real FPS.
9. Canvas dimensions and device pixel ratio can break mobile perf.
10. Touch controls must be tested with synthetic pointer events.
11. Client prediction must never become client authority.
12. Traffic RNG must be deterministic and segment-seeded.
13. Fork defaults must be deterministic.
14. Same tick finish ties must have explicit rules.
15. Collision must not depend on object iteration order.
16. Asset strip manifest changes must be width-pinned by test.
17. Never put gameplay constants directly in renderer code.
18. Do not let audio timing affect gameplay.
19. Do not let wall-clock time enter engine state.
20. The Luau port will punish every casual JS convenience.

## 25. Recommended implementation detail: reducer order

Pick and pin reducer order early.

Suggested tick order:

```text
1. Clear per-tick events.
2. Apply queued player input.
3. Apply AI input.
4. Update car acceleration/brake/drag.
5. Update steering/lane/drift.
6. Advance road position.
7. Resolve forks/checkpoints/finish.
8. Spawn/update traffic.
9. Resolve traffic collision.
10. Resolve rival collision.
11. Update timer.
12. Score near-misses / bonuses.
13. Run invariants in debug/test.
14. Hash snapshot when requested.
```

Do not casually reorder this later. Reordering changes game feel and hashes.

## 26. Recommendation

Proceed with the **Fireline-derived stack**.

The strongest version of this project is not “OutRun in a game engine.” It is:

> Fireline’s deterministic real-time architecture, but with an arcade road renderer and racing reducer.

That gives us:

- Browser reach.
- Self-hostable multiplayer.
- Replays.
- Headless testing.
- AI tuning.
- Determinism.
- Robust debugging.
- A realistic Roblox/Luau path.

The first coding ally task should be `slice-001-project-skeleton`, followed immediately by PRNG/fixed/hash fixtures before any renderer work. Once the deterministic spine is pinned, the road renderer can evolve without corrupting the game’s core contract.
