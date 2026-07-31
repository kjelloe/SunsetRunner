// engine/collision.js — rival collision resolution (tick order step 10).
// Arcade soft-bump: overlapping same-segment cars each shed speed and are shoved
// apart. Order-INDEPENDENT: all effects are computed from the pre-bump state
// into per-seat deltas, then applied together, so the result never depends on
// seat iteration order (§24, gotcha #15). Runs only when the room enables
// rivalCollision; with 0/1 seats it is a no-op (so checkpoint_1a is untouched).

import { overlapping, BUMP_SLOW, BUMP_PUSH } from "../shared/collision.js";
import { clampI32 } from "../shared/fixedmath.js";
import { MAX_LANE_OFFSET } from "./car_physics.js";

export function resolveRivalCollisions(state, tick) {
  const seats = state.seats.filter((s) => s.active && s.finishTicks < 0 && !s.timedOut);
  const dSpeed = new Map();
  const dLane = new Map();
  for (const s of seats) { dSpeed.set(s.id, 0); dLane.set(s.id, 0); }

  const bumped = [];
  const seen = new Set();
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const a = seats[i];
      const b = seats[j];
      if (!overlapping(a, b)) continue;
      dSpeed.set(a.id, dSpeed.get(a.id) - BUMP_SLOW);
      dSpeed.set(b.id, dSpeed.get(b.id) - BUMP_SLOW);
      // push apart by pre-bump lateral order; tie-break by seatId (determinism).
      const dir = a.laneX < b.laneX ? -1 : (a.laneX > b.laneX ? 1 : (a.id < b.id ? -1 : 1));
      dLane.set(a.id, dLane.get(a.id) + dir * BUMP_PUSH);
      dLane.set(b.id, dLane.get(b.id) - dir * BUMP_PUSH);
      for (const id of [a.id, b.id]) {
        if (!seen.has(id)) { seen.add(id); bumped.push(id); }
      }
    }
  }

  for (const s of seats) {
    s.speed = clampI32(s.speed + dSpeed.get(s.id), 0, 0x7fffffff);
    s.laneX = clampI32(s.laneX + dLane.get(s.id), -MAX_LANE_OFFSET, MAX_LANE_OFFSET);
  }

  return bumped.map((id) => ({ type: "collision", kind: "rival", seatId: id, tick }));
}
