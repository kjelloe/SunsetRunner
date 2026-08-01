// client/session_local.js — local (offline) session driving the engine reducer.
// Same seam a remote session will implement later: setInput / tick / getState.
// Import-safe (no DOM).

import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK, CMD_FORK_CHOICE } from "../engine/commands.js";

export function createLocalSession(courseSet, carSet, opts = {}) {
  const seed = (opts.seed ?? 12345) >>> 0;
  const courseId = opts.courseId ?? 1;
  const carId = opts.carId ?? 1;
  const ctx = { courseSet, carSet, trafficConfig: opts.trafficConfig };
  let state = createInitialState({
    seed, courseSet, carSet, courseId, seats: [{ id: 1, carId }],
    startTimeTicks: opts.startTimeTicks, trafficConfig: opts.trafficConfig,
  });
  let held = { steer: 0, accel: 0, brake: 0 };

  return {
    setInput(input) { held = input; },
    setForkChoice(choice) {
      state = apply(state, { type: CMD_FORK_CHOICE, seatId: 1, choice }, ctx);
    },
    // One authoritative sim step: apply held input, then advance one tick.
    tick() {
      state = apply(state, { type: CMD_INPUT, seatId: 1, ...held }, ctx);
      state = apply(state, { type: CMD_ADVANCE_TICK }, ctx);
      return state;
    },
    getState() { return state; },
  };
}
