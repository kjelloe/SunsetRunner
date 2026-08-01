// engine/road_progress.js — advance a seat along the road graph.
// Integer only, in place on an already-cloned seat. Linear routing this slice
// (forks/checkpoints/timer arrive in later slices). Returns whether the seat
// just crossed the finish so the reducer can emit the event.

import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment, nextSegment } from "../shared/road_data.js";

function segmentLength(courseSet, segmentId) {
  return getSegment(courseSet, segmentId).stripCount * ROAD_UNIT;
}

function isFork(seg) {
  return seg.forkLeft >= 0 || seg.forkRight >= 0;
}

// Step 6 (+7 finish): advance roadZ by speed, carrying across segment
// boundaries. On reaching a segment whose next is -1, the seat finishes.
// Returns the ids of any segments newly ENTERED this tick so the reducer can
// award checkpoint bonuses (step 7).
export function advanceRoad(seat, courseSet, tick) {
  if (seat.finishTicks >= 0) return { finished: false, entered: [] };

  seat.roadZ += seat.speed;
  let segLen = segmentLength(courseSet, seat.segmentId);
  const entered = [];

  while (seat.roadZ >= segLen) {
    seat.roadZ -= segLen;
    const cur = getSegment(courseSet, seat.segmentId);
    const nxt = nextSegment(courseSet, seat.segmentId, seat.forkChoice);
    if (isFork(cur)) seat.forkChoice = 0; // choice consumed at the fork
    if (nxt === -1) {
      seat.segmentId = -1;
      seat.finishTicks = tick;
      seat.roadZ = 0;
      seat.speed = 0; // arcade: stop at the line
      return { finished: true, entered };
    }
    seat.segmentId = nxt;
    entered.push(nxt);
    segLen = segmentLength(courseSet, nxt);
  }
  return { finished: false, entered };
}
