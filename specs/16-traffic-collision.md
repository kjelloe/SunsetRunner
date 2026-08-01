# 16 — Traffic collision

Established in `marker-0016`. Player/AI vs traffic collision — the arcade crash
that makes traffic a real hazard. Completes the collision picture (traffic +
rival). Always on (not gated like rival collision).

## Rule (`engine/collision.js`, `shared/collision.js`)

`resolveTrafficCollisions(state, tick)` (tick order step 9, before rival
collision): for each active, unfinished, non-timed-out seat that is `overlapping`
a traffic car (same segment, `|Δroadz| < CAR_LENGTH`, `|ΔlaneX| < CAR_WIDTH`),
cut speed to `1/TRAFFIC_CRASH_DEN` (a third) and emit a `collision` event
`{ kind:"traffic" }`. One crash per seat per tick; no pile-up, no lateral shove
(traffic holds its lane). No new state field — a crash is just a speed cut.

## Placement

Runs as a cross-entity pass after the per-seat loop: step 9 (traffic) then step
10 (rival, gated). Because timer/finish don't read speed, this is equivalent to
the §25 order.

## Golden repins (conscious, this marker)

Traffic collision is always on, so the accel-only goldens change:
- **`physics_1a`** and **`checkpoint_1a`** (both accel-only, seed 12345): the car,
  never steering, plows into traffic and crashes ~9×, finishing at tick **404**
  instead of 215. `hashTick 10/100` are unchanged (no crash before tick 123);
  later hashes/census/finish repinned. `checkpoint_1a` maxTicks raised to 500;
  new `finalHash 0e884b18cd3c2126`.
- **AI solo golden** — the AI *dodges* most traffic (only 4 crashes) and finishes
  at tick **307**, `518f6d9c4f188ae3`. A nice demonstration that lane-holding +
  dodge beats blind acceleration.
- **`collision_1a`** — UNCHANGED: those two cars never reach/overlap traffic in
  60 ticks.

All repins verified in Luau too (`checkpoint-1a`/`collision-1a` gates green).

## Luau twin

`luau/collision.luau` gains `resolveTrafficCollisions`; `luau/reducer.luau` runs
it (always) before the gated rival pass — matching JS byte-for-byte.

## Verified

`test/collision.test.js` — speed-cut + traffic event, and lane/segment misses are
ignored. Repinned physics/checkpoint/AI goldens. `./test.sh` → 95/95 + 3 Luau
gates.

## Milestone 4 status

Now complete: replay, AI, sim campaign, rival collision, **traffic collision**.
Next: sweep battery + fairness tools (§16 of the brief: mirror / car-swap /
traffic-swap / seat-order), and client prediction/reconciliation (§21.2).
