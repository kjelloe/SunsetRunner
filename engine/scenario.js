// engine/scenario.js — deterministic scenario replay (the local race loop,
// headless). A scenario is a seed + scheduled input changes; the runner drives
// the reducer to completion and returns the state, an event census, and pinned
// snapshot hashes. This is "replay as bug report" (§21.2) and the basis of the
// checkpoint_1a golden. Pure given its ctx.

import { createInitialState } from "./state.js";
import { apply } from "./reducer.js";
import { CMD_INPUT, CMD_ADVANCE_TICK } from "./commands.js";
import { hashSnapshot } from "./snapshot.js";

// Seat-level events worth pinning as a census (traffic emits none this milestone).
const CENSUS_EVENTS = new Set(["checkpoint", "finish", "timeout", "collision"]);

function allDone(state) {
  return state.seats.every((s) => s.finishTicks >= 0 || s.timedOut);
}

// scenario: { seed, courseId, carId?, seats?, startTimeTicks, maxTicks, rivalCollision?,
//   inputs:[{tick, seatId?, steer, accel, brake}], hashTicks:[] }
// ctx: { courseSet, carSet, trafficConfig }
// Inputs may target a seat (seatId, default 1); multiple inputs can share a tick.
export function runScenario(scenario, ctx) {
  const byTick = new Map();
  for (const inp of scenario.inputs) {
    const t = inp.tick;
    if (!byTick.has(t)) byTick.set(t, []);
    byTick.get(t).push(inp);
  }

  const seats = scenario.seats || [{ id: 1, carId: scenario.carId }];
  const runCtx = scenario.rivalCollision ? { ...ctx, rivalCollision: 1 } : ctx;

  let state = createInitialState({
    seed: scenario.seed,
    courseSet: ctx.courseSet,
    carSet: ctx.carSet,
    courseId: scenario.courseId,
    seats,
    startTimeTicks: scenario.startTimeTicks,
    trafficConfig: ctx.trafficConfig,
  });

  const hashTicks = new Set(scenario.hashTicks || []);
  const hashes = {};
  const census = []; // ordered { type, tick } for CENSUS_EVENTS
  let lastTick = 0;

  for (let t = 1; t <= scenario.maxTicks; t++) {
    const inps = byTick.get(t);
    if (inps) {
      for (const inp of inps) {
        state = apply(state, { type: CMD_INPUT, seatId: inp.seatId ?? 1, steer: inp.steer, accel: inp.accel, brake: inp.brake }, runCtx);
      }
    }
    state = apply(state, { type: CMD_ADVANCE_TICK }, runCtx);
    for (const e of state.events) {
      if (CENSUS_EVENTS.has(e.type)) census.push({ type: e.type, tick: e.tick });
    }
    if (hashTicks.has(t)) hashes[t] = hashSnapshot(state);
    lastTick = t;
    if (allDone(state)) break;
  }

  return { state, hashes, census, finalHash: hashSnapshot(state), lastTick };
}
