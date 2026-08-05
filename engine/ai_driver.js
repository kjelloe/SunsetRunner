// engine/ai_driver.js — deterministic AI driver (§14). AI is just another
// command source: chooseInput(state, seatId) -> an input frame. Pure, integer,
// seed-free (reads only state), so AI-driven runs are perfectly reproducible —
// the core requirement for using AI as a tuning/measurement instrument.

import { LANE_WIDTH, STEER_UNIT } from "../shared/constants.js";
import { absI32 } from "../shared/fixedmath.js";
import { ROAD_HALF_WIDTH } from "./car_physics.js";

const LOOKAHEAD = 6000; // roadZ ahead to watch for traffic

// Hold your lane; only steer to dodge traffic ahead or to recover from off-road.
// Lane-holding (not centre-seeking) is what lets a staggered field race instead
// of converging on the centre line and piling up.
export function chooseInput(state, seatId) {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.finishTicks >= 0 || seat.timedOut) return { steer: 0, accel: 0, brake: 0 };

  // Nearest traffic ahead in our segment and roughly our lane.
  let threat = null;
  for (const t of state.traffic) {
    if (t.segmentId !== seat.segmentId) continue;
    const dz = t.roadZ - seat.roadZ;
    if (dz <= 0 || dz > LOOKAHEAD) continue;
    if (absI32(t.laneX - seat.laneX) >= LANE_WIDTH) continue;
    if (!threat || dz < threat.dz) threat = { dz, laneX: t.laneX };
  }

  let steer;
  if (threat) {
    // Dodge away from the threat; when it is dead-ahead (same lane), steer toward
    // centre — a SYMMETRIC rule, so the AI itself doesn't favour a start lane
    // (an earlier `>=` always dodged left, biasing seat-order fairness).
    if (threat.laneX > seat.laneX) steer = -1;
    else if (threat.laneX < seat.laneX) steer = 1;
    else steer = seat.laneX > 0 ? -1 : 1;
  } else if (seat.laneX > ROAD_HALF_WIDTH) {
    steer = -1; // drifted off the right edge — steer back on
  } else if (seat.laneX < -ROAD_HALF_WIDTH) {
    steer = 1;
  } else {
    steer = 0; // hold lane
  }
  return { steer: steer * STEER_UNIT, accel: 1, brake: 0 };
}
