# 51 — Race summary + restart countdown

Established in `marker-0055`. When the race ends (you finish or time out), a
summary ranks the whole field by how far each got, then a 30 s countdown starts a
fresh race with the same car/difficulty. Client-only, no engine change.

## Ranking (`client/race_summary.js`)

- `stageNumber(courseSet, startSegment, segmentId)` — 1-based BFS hop distance
  from the course start (handles forks); the "how far did they get" number.
- `buildSummary(courseSet, courseId, carSet, players)` — ranks the field:
  finishers first (earliest `finishTicks`), then non-finishers by stage then
  `roadZ`. Each row carries name (car), identity colour, stage/FINISHED, `isYou`.
- `playersFromState(state)` — gathers the field from the client state (self seat
  + ghosts), flagging `isYou`.
- `drawRaceSummary(g, view, rows, secs)` — RACE OVER, one row per player
  (`rank. name … STAGE n / FINISHED`), and `NEW RACE IN Ns`.

## Wiring (`client/main.js`)

New `summary` phase. When `racing` and the self seat finishes or times out, build
the summary and enter it; the sim is frozen (no ticks), the finish confetti keeps
animating behind the overlay. After `NEW_RACE_SECONDS` (10), a **local** race
restarts via `start(activeCarId, activeTimeScale)` — a fresh session + 3-2-1-GO.

## Verified

`test/race_summary.test.js`: stage distances, finishers-first ranking, finish-time
tiebreak, `playersFromState` self/ghost split, and the summary draw. `./test.sh`
→ 227/227 + 4 Luau gates.

## Not verified / deferred

Multiplayer: end detection uses the local player's view, and the 30 s auto-restart
is **local-only** (a shared "all players out / someone finished → everyone to a new
race" is server-authoritative — deferred with the room-side race framing). The
"points from there" idea from the drop-in ask needs a scoring system that doesn't
exist yet.
