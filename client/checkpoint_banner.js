// client/checkpoint_banner.js — "CHECKPOINT" gantry logic (CLIENT ONLY).
// A checkpoint is awarded on ENTERING a segment with checkpointTicks > 0, so the
// banner marks that boundary: two posts at the road edges + a CHECKPOINT banner
// slung between them at tree-line height (drawn in renderer_canvas). Pure lookup
// here so it is node-testable.

import { ROAD_UNIT } from "../shared/constants.js";
import { getSegment } from "../shared/road_data.js";

// World-distance to the next checkpoint boundary (the linear `next` segment that
// grants time), or null. Forks are handled by the fork preview, so only the
// linear next is considered here.
export function checkpointAhead(courseSet, seat) {
  if (!seat || seat.segmentId === -1) return null;
  const cur = getSegment(courseSet, seat.segmentId);
  if (cur.next > 0) {
    const nxt = getSegment(courseSet, cur.next);
    if (nxt.checkpointTicks > 0) {
      return { segId: cur.next, distance: cur.stripCount * ROAD_UNIT - seat.roadZ };
    }
  }
  return null;
}

// Draw from the moment the boundary is within the visible road (~horizon) so the
// gantry appears small on the horizon and scales up as you approach.
export const CHECKPOINT_DRAW_RANGE = 200 * ROAD_UNIT;
