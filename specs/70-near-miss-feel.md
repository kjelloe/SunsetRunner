# 70 — Near-miss feel (client-detected whoosh + streak)

Established in `marker-0094`. Client-only (presentation), no engine change, no
golden repin, no Luau change. Completes the backlog "near-miss feel" and wires up
the `nearmiss` SFX that had existed in `client/audio.js` but was never fired.

## Why

The engine has no near-miss event by design: a crash is server-authoritative and
hashed, a near miss is purely cosmetic. So the feedback is detected on the client
from the traffic it already renders — a whoosh + a brief side streak when the
local car passes a traffic car *close but without hitting it*.

## Detection

New `client/near_miss.js` (`createNearMiss`) mirrors the engine's collision
geometry (`shared/collision.js`) so the "near" band sits just outside a real
crash. Per frame, for each traffic car on the local car's segment:

- longitudinal: `|ΔroadZ| < CAR_LENGTH` (512) — same closeness as a crash;
- lateral: `CAR_WIDTH (200) ≤ |ΔlaneX| < NEAR_WIDTH (460)` — outside the crash
  band (`< CAR_WIDTH` would be an overlap/crash), inside ~1.8 lanes.

Guards: nothing fires while the car is crashed (`crashedTicks > 0`) or off-track
(`segmentId === -1`), or for cars on a different segment. Each traffic id fires at
most once (a `Set`, pruned as cars despawn), and a **250 ms audio cooldown**
collapses a burst through dense traffic into a single whoosh. `update()` returns 1
on a new fire so `main.js` plays `audio.event("nearmiss")` once; `reset()` clears
state on race start.

## Visual

A short (~220 ms) white speed-streak fades in from the edge the car passed on
(side = sign of its lateral offset), drawn over the scene in the render block,
right after the crash flash.

## Determinism / parity

None affected — `near_miss.js` is the client float layer, reads engine state
read-only, writes nothing. Engine hashes, all golden fixtures and the 4 Luau
parity gates are untouched.

## Verified

`test/near_miss.test.js` (6 cases): fires once on a close pass and dedups; no fire
when overlapping (crash) / too far / behind the longitudinal window; suppressed
while crashed, off-track, or on a different segment; the cooldown collapses two
cars to one whoosh; `reset()` re-arms; the streak draws on the correct side and
only within its window. `npm test` → 302/302; `./test.sh` browser smoke boots
clean.

## Not verified / deferred

Real feel (the 460-unit band, 250 ms cooldown, streak strength/duration) needs the
`PLAYTEST.md` device pass — in particular whether dense course-4 traffic makes the
whoosh too frequent even with the cooldown. Client-detected timing is a frame
observation, not an engine timestamp — fine for a cosmetic cue, never a score.
