// client/fork_preview.js — "FORK AHEAD" warning (CLIENT ONLY, presentation).
// ~5 s before a fork, name each branch (by its scenery theme — beach/canyon/
// forest) and show a left/right arrow, highlighting the side the car's lane
// position would currently take (marker-0048 makes that the default). Pure
// lookup logic is node-testable.

import { ROAD_UNIT, TICK_HZ } from "../shared/constants.js";
import { getSegment } from "../shared/road_data.js";
import { themeFor } from "./scenery.js";

const WARN_SECONDS = 5;

function isFork(seg) {
  return seg.forkLeft >= 0 || seg.forkRight >= 0;
}

// The fork the car is approaching and the world-distance to the split (which is
// at the END of the fork segment), or null if none is near. Looks at the current
// segment and the immediate next one.
export function forkAhead(courseSet, seat) {
  if (!seat || seat.segmentId === -1) return null;
  const cur = getSegment(courseSet, seat.segmentId);
  const curRemain = cur.stripCount * ROAD_UNIT - seat.roadZ;
  if (isFork(cur)) {
    return { forkSegId: cur.id, left: cur.forkLeft, right: cur.forkRight, distance: curRemain };
  }
  if (cur.next > 0) {
    const nxt = getSegment(courseSet, cur.next);
    if (isFork(nxt)) {
      return { forkSegId: nxt.id, left: nxt.forkLeft, right: nxt.forkRight, distance: curRemain + nxt.stripCount * ROAD_UNIT };
    }
  }
  return null;
}

// Seconds until the split at the current speed (Infinity when stopped).
export function secondsToFork(distance, speed) {
  return speed > 0 ? distance / speed / TICK_HZ : Infinity;
}

// Branch name = the scenery theme name of the branch's first segment, uppercased.
export function branchName(scenery, courseSet, segId) {
  if (segId < 0) return "?";
  const seg = getSegment(courseSet, segId);
  return themeFor(scenery, seg.scenerySet).name.toUpperCase();
}

export function drawForkPreview(g, view, seat, courseSet, scenery) {
  const fa = forkAhead(courseSet, seat);
  if (!fa) return;
  const secs = secondsToFork(fa.distance, seat.speed);
  // Show inside the warning window, or once physically very close (so a crawling
  // car still gets the heads-up).
  if (secs > WARN_SECONDS && fa.distance > ROAD_UNIT * 20) return;

  const leftName = branchName(scenery, courseSet, fa.left);
  const rightName = branchName(scenery, courseSet, fa.right);
  const leaning = seat.laneX < 0 ? "left" : "right"; // side the fork would take now

  const y = view.h * 0.30;
  g.textAlign = "center";
  g.fillStyle = "#ffe14d";
  g.font = `bold ${Math.round(view.h * 0.045)}px sans-serif`;
  g.fillText("FORK AHEAD", view.w / 2, y);

  g.font = `${Math.round(view.h * 0.05)}px sans-serif`;
  g.fillStyle = leaning === "left" ? "#ffffff" : "#9a9ab0";
  g.fillText(`◄ ${leftName}`, view.w * 0.28, y + view.h * 0.08);
  g.fillStyle = leaning === "right" ? "#ffffff" : "#9a9ab0";
  g.fillText(`${rightName} ►`, view.w * 0.72, y + view.h * 0.08);

  g.fillStyle = "#ffe14d";
  g.font = `${Math.round(view.h * 0.03)}px sans-serif`;
  g.fillText("steer into your branch (or Q / E)", view.w / 2, y + view.h * 0.14);
  g.textAlign = "left";
}

export { WARN_SECONDS };
