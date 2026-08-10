// engine/boost.js — boost-pad pickup (tick order step 9c). Pads are COURSE DATA
// (segment.boostPads: [{ roadZ, laneX }]), read from ctx like checkpoints/curves,
// so they add no engine state — only the seat's boostTicks countdown. Driving
// over a pad sets boostTicks; the pad is not consumed (it is a fixed road marker),
// so re-crossing it simply refreshes the boost. Integer only, order-independent.

import { absI32 } from "../shared/fixedmath.js";
import { getSegment } from "../shared/road_data.js";
import { BOOST_TICKS, PAD_LENGTH, PAD_WIDTH } from "../shared/constants.js";

export function resolveBoostPickups(state, courseSet) {
  if (!courseSet) return;
  for (const seat of state.seats) {
    if (!seat.active || seat.finishTicks >= 0 || seat.timedOut) continue;
    const pads = getSegment(courseSet, seat.segmentId).boostPads;
    if (!pads || pads.length === 0) continue;
    for (const pad of pads) {
      if (absI32(seat.roadZ - pad.roadZ) < PAD_LENGTH && absI32(seat.laneX - pad.laneX) < PAD_WIDTH) {
        seat.boostTicks = BOOST_TICKS;
        break; // one pad per seat per tick is enough
      }
    }
  }
}
