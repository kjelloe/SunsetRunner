// engine/ai_driver.js — deterministic AI driver (§14). AI is just another
// command source: chooseInput(state, seatId) -> an input frame. Pure, integer,
// seed-free (reads only state), so AI-driven runs are perfectly reproducible —
// the core requirement for using AI as a tuning/measurement instrument.

import { LANE_WIDTH, STEER_UNIT } from "../shared/constants.js";
import { absI32 } from "../shared/fixedmath.js";
import { ROAD_HALF_WIDTH } from "./car_physics.js";

// AI difficulty tiers. `lookahead` is how far ahead (roadZ) the AI watches for
// traffic — see sooner, dodge cleaner, crash less. Throttle is a deterministic
// duty cycle keyed on state.tick (NO wall-clock): the car holds the gas for
// `throttleOn` of every `throttlePeriod` ticks, so a weaker tier coasts and runs
// slower. `medium` is the ORIGINAL behaviour (lookahead 6000, gas every tick), so
// the default keeps the AI golden byte-identical — no repin.
export const AI_SKILL = {
  easy:   { lookahead: 3000, throttleOn: 3, throttlePeriod: 4 }, // late dodges, coasts 1/4
  medium: { lookahead: 6000, throttleOn: 1, throttlePeriod: 1 }, // original: always flat out
  hard:   { lookahead: 9000, throttleOn: 1, throttlePeriod: 1 }, // sees furthest, always flat out
};
export const DEFAULT_SKILL = AI_SKILL.medium;

export function skillFor(level) {
  return (level && AI_SKILL[level]) || DEFAULT_SKILL;
}

// Hold your lane; only steer to dodge traffic ahead or to recover from off-road.
// Lane-holding (not centre-seeking) is what lets a staggered field race instead
// of converging on the centre line and piling up. `skill` defaults to the
// original medium tier, so callers that pass nothing (the golden) are unchanged.
export function chooseInput(state, seatId, skill = DEFAULT_SKILL) {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.finishTicks >= 0 || seat.timedOut) return { steer: 0, accel: 0, brake: 0 };

  // Nearest traffic ahead in our segment and roughly our lane.
  let threat = null;
  for (const t of state.traffic) {
    if (t.segmentId !== seat.segmentId) continue;
    const dz = t.roadZ - seat.roadZ;
    if (dz <= 0 || dz > skill.lookahead) continue;
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
  // Deterministic throttle duty cycle (weaker tiers coast); keyed on state.tick.
  const accel = (state.tick % skill.throttlePeriod) < skill.throttleOn ? 1 : 0;
  return { steer: steer * STEER_UNIT, accel, brake: 0 };
}
