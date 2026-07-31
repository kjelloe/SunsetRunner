// engine/road_progress.js — advance a seat along the road graph.
// Integer only, in place on an already-cloned seat. Linear routing this slice
// (forks/checkpoints/timer arrive in later slices). Returns whether the seat
// just crossed the finish so the reducer can emit the event.

import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment, nextSegment } from "../shared/road_data.js";

function segmentLength(courseSet, segmentId) {
  return getSegment(courseSet, segmentId).stripCount * ROAD_UNIT;
}

// Step 6 (+7 finish): advance roadZ by speed, carrying across segment
// boundaries. On reaching a segment whose next is -1, the seat finishes.
export function advanceRoad(seat, courseSet, tick) {
  if (seat.finishTicks >= 0) return { finished: false };

  seat.roadZ += seat.speed;
  let segLen = segmentLength(courseSet, seat.segmentId);

  while (seat.roadZ >= segLen) {
    seat.roadZ -= segLen;
    const nxt = nextSegment(courseSet, seat.segmentId, 0);
    if (nxt === -1) {
      seat.segmentId = -1;
      seat.finishTicks = tick;
      seat.roadZ = 0;
      seat.speed = 0; // arcade: stop at the line
      return { finished: true };
    }
    seat.segmentId = nxt;
    segLen = segmentLength(courseSet, nxt);
  }
  return { finished: false };
}
