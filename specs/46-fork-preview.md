# 46 — Fork preview (name + arrows)

Established in `marker-0050`. About 5 s before a fork, a **FORK AHEAD** message
names each branch and shows a left/right arrow, highlighting the side the car's
lane position would currently take (marker-0048). Client-only, renderer, no
engine change. Replaces the old bare `◄ Q FORK E ►` hint.

## Logic (`client/fork_preview.js`)

- `forkAhead(courseSet, seat)` → the upcoming fork (`forkSegId`, `left`, `right`)
  and the world-distance to the split (at the END of the fork segment), looking
  at the current segment and the immediate next. `null` if none is near.
- `secondsToFork(distance, speed)` → time to the split at the current speed
  (`Infinity` when stopped).
- `branchName(scenery, courseSet, segId)` → the branch's **scenery theme name**
  (BEACH / CANYON / FOREST), reusing specs/42 so names need no new data.
- `drawForkPreview(...)` → shows within `WARN_SECONDS` (5) or once physically
  close; highlights the leaning side (white vs grey) so you see which branch your
  current position takes, with a "steer into your branch (or Q / E)" line.

## Verified

`test/fork_preview.test.js`: fork found from the segment before and from inside
the fork segment, distance math, null when far, `secondsToFork` (speed / stopped),
`branchName` → theme, and `drawForkPreview` paints when close / silent when far.
`./test.sh` → 206/206 + 4 Luau gates.

## Not verified / deferred

On-screen placement/legibility needs eyes (§17), and it will share the top band
with the big race timer (a separate slice) — positions may need adjusting so they
don't overlap.
