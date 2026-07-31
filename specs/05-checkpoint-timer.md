# 05 — Checkpoint timer

Established in `marker-0005` (slice-006). Classic arcade checkpoint-extension
timer: start with a time budget, top it up at checkpoints, time out at zero.
This closes the solo gameplay loop (drive → checkpoint → finish or time out).

## State (added to each seat)

- `timerTicks` — remaining time in ticks (20 Hz). Starts at the race start time.
- `timedOut` — `0/1`; set when `timerTicks` hits zero before the finish.

Both join the hashed seat state, so `engine/snapshot.js` now serializes them —
**the `physics_1a` golden was repinned** (a conscious act, logged in dev-log).

## Config

- Race start time: `data/checkpoints.json` → `startTimeTicks` (1500 = 75 s),
  loaded/validated by `shared/checkpoint_data.js`. Threaded via
  `createInitialState({ startTimeTicks })` (falls back to `DEFAULT_START_TIME_TICKS`).
- Per-checkpoint bonus: `segment.checkpointTicks` in `data/roads.json` (the
  `sunset_coast` checkpoint on segment 2 grants 600 = 30 s).

## Reducer rules (in `advance_tick`, pinned tick order)

Per active, unfinished, not-timed-out seat:
- **Step 7 (checkpoints):** for each segment newly entered this tick (from
  `advanceRoad`'s `entered` list), if its `checkpointTicks > 0` add that bonus
  to `timerTicks` and emit a `checkpoint` event `{ seatId, segmentId, bonus }`.
- **Step 11 (timer):** `timerTicks -= 1`. If it reaches `≤ 0`, clamp to 0, set
  `timedOut = 1`, zero the speed, and emit a `timeout` event.
- A seat that finishes this tick skips timer/timeout entirely (finish wins).

Timed-out and finished seats are skipped on subsequent ticks.

## Golden (`test/fixtures/physics_1a.json`)

The accel-only run (seed 12345, default 1500-tick start): checkpoint fires at
tick **119** (+600), finish at tick **215**, final `timerTicks` **1886**
(1500 − 214 bled + 600). A separate timeout scenario (`startTimeTicks = 30`)
times the seat out at tick **30**, speed 0, `finishTicks = -1`. Snapshot hashes
at t10/t100/t400 are repinned for the enlarged seat state.

## HUD

`client/hud.js` shows remaining seconds (`displayTime = ceil(timerTicks/TICK_HZ)`),
turning red under 5 s, and a `TIME UP` banner on timeout.

## Deferred

Multiple checkpoint segments, timer-reset-at-checkpoint variants, and
multiplayer finish/timeout ordering come with later content/multiplayer slices.
