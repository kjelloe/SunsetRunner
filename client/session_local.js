// client/session_local.js — local (offline) session driving the engine reducer.
// Same seam a remote session implements: setInput / tick / getState. Supports AI
// opponents (opts.aiCount) so single-player is a RACE, not a time-trial — they
// drive with the deterministic ai_driver and render as named ghosts, like real
// players. Import-safe (no DOM).

import { createInitialState } from "../engine/state.js";
import { apply } from "../engine/reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK, CMD_FORK_CHOICE } from "../engine/commands.js";
import { chooseInput } from "../engine/ai_driver.js";

// Rival name pool (feels like real players above their cars).
const AI_NAMES = ["Max", "Zoe", "Kai", "Ava", "Leo", "Mia", "Ivy", "Rex", "Nia", "Ace", "Jax", "Uma"];

export function createLocalSession(courseSet, carSet, opts = {}) {
  const seed = (opts.seed ?? 12345) >>> 0;
  const courseId = opts.courseId ?? 1;
  const carId = opts.carId ?? 1;
  const aiCount = Math.max(0, Math.min(opts.aiCount ?? 0, AI_NAMES.length));
  const ctx = { courseSet, carSet, trafficConfig: opts.trafficConfig, timeScale: opts.timeScale ?? 100 };

  // Seat 1 is the player; AI seats are staggered across start lanes with cars
  // cycled through the roster. `aiMeta` keeps their (non-engine) name/car.
  const seats = [{ id: 1, carId }];
  const aiMeta = new Map();
  for (let i = 0; i < aiCount; i++) {
    const id = i + 2;
    const aiCar = (i % carSet.cars.length) + 1;
    const laneX = Math.round((i + 1 - aiCount / 2) * 256); // spread off the centre line
    seats.push({ id, carId: aiCar, laneX });
    aiMeta.set(id, { name: AI_NAMES[i % AI_NAMES.length], carId: aiCar });
  }

  let state = createInitialState({
    seed, courseSet, carSet, courseId, seats,
    startTimeTicks: opts.startTimeTicks, trafficConfig: opts.trafficConfig,
  });
  let held = { steer: 0, accel: 0, brake: 0 };

  // Rival seats projected as ghost views (same shape the renderer/name-tags use).
  function ghosts() {
    const self = state.seats[0];
    return state.seats.slice(1).map((s) => ({
      seatId: s.id, carId: s.carId, name: aiMeta.get(s.id)?.name || `P${s.id}`,
      segmentId: s.segmentId, roadZ: s.roadZ, laneX: s.laneX, speed: s.speed,
      finishTicks: s.finishTicks,
      collisionActive: self && s.segmentId === self.segmentId ? 1 : 0,
    }));
  }

  return {
    setInput(input) { held = input; },
    setForkChoice(choice) {
      state = apply(state, { type: CMD_FORK_CHOICE, seatId: 1, choice }, ctx);
    },
    // One sim step: player input, then each AI's input, then advance a tick.
    tick() {
      state = apply(state, { type: CMD_INPUT, seatId: 1, ...held }, ctx);
      for (let i = 1; i < state.seats.length; i++) {
        const s = state.seats[i];
        if (s.finishTicks >= 0 || s.timedOut) continue;
        state = apply(state, { type: CMD_INPUT, seatId: s.id, ...chooseInput(state, s.id) }, ctx);
      }
      state = apply(state, { type: CMD_ADVANCE_TICK }, ctx);
      return state;
    },
    // Full engine state (hashable) plus rival GHOSTS for the renderer/name-tags.
    // The renderer reads seats[0] as self and draws state.ghosts, so the extra AI
    // seats in state.seats are ignored by it but remain for hashing/replay.
    getState() {
      return { ...state, ghosts: ghosts() };
    },
  };
}
