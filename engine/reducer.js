// engine/reducer.js — the authoritative pure reducer: apply(state, command, ctx).
// Never mutates input state. Integer math only. `ctx` threads static content
// (carSet, courseSet) that is not part of hashed state. Tick order is pinned
// (specs/01); do not casually reorder — it changes feel and hashes.

import { CMD_INPUT, CMD_ADVANCE_TICK, CMD_FORK_CHOICE, validate } from "./commands.js";
import { cloneState } from "./copy_state.js";
import { stepLongitudinal, stepLateral, applyCurvePush } from "./car_physics.js";
import { advanceRoad, curveAt } from "./road_progress.js";
import { spawnSegmentTraffic, advanceTraffic, advanceHazards } from "./traffic.js";
import { resolveTrafficCollisions, resolveHazardCollisions, resolveRivalCollisions } from "./collision.js";
import { getCar } from "../shared/car_data.js";
import { getSegment } from "../shared/road_data.js";
import { truncDivI32 } from "../shared/fixedmath.js";

export function apply(state, command, ctx = {}) {
  const v = validate(command);
  if (!v.ok) throw new Error(`invalid command: ${v.reason}`);

  const next = cloneState(state);

  if (command.type === CMD_INPUT) {
    const seat = next.seats.find((s) => s.id === command.seatId);
    if (seat && seat.active && seat.finishTicks < 0) {
      seat.steerHeld = command.steer;
      seat.accelHeld = command.accel;
      seat.brakeHeld = command.brake;
    }
    return next;
  }

  if (command.type === CMD_FORK_CHOICE) {
    const seat = next.seats.find((s) => s.id === command.seatId);
    if (seat && seat.active && seat.finishTicks < 0) seat.forkChoice = command.choice;
    return next;
  }

  if (command.type === CMD_ADVANCE_TICK) {
    next.events = [];                 // 1. clear per-tick events
    next.tick = state.tick + 1;
    // 2/3. input already applied via input commands (queued per seat).
    for (const seat of next.seats) {  // deterministic array order
      if (!seat.active || seat.finishTicks >= 0 || seat.timedOut) continue;
      if (seat.crashedTicks > 0) seat.crashedTicks -= 1; // recover from a crash stun
      const car = getCar(ctx.carSet, seat.carId);
      stepLongitudinal(seat, car);    // 4. accel / brake / drag
      stepLateral(seat, car);         // 5. steer / lane
      applyCurvePush(seat, curveAt(ctx.courseSet, seat.segmentId, seat.roadZ)); // 5b. curve drift
      const r = advanceRoad(seat, ctx.courseSet, next.tick); // 6. road
      if (r.finished) {
        next.events.push({ type: "finish", seatId: seat.id, tick: next.tick });
        continue; // finished this tick — no timer/timeout
      }
      // 7. checkpoints: entering a segment with a bonus extends the timer.
      for (const segId of r.entered) {
        // Difficulty scales the checkpoint bonus (ctx.timeScale, default 100 =
        // identity so goldens are unaffected). Integer % via truncDivI32.
        const raw = getSegment(ctx.courseSet, segId).checkpointTicks;
        const scale = ctx.timeScale ?? 100;
        const bonus = scale === 100 ? raw : truncDivI32(raw * scale, 100);
        if (bonus > 0) {
          seat.timerTicks += bonus;
          next.events.push({ type: "checkpoint", seatId: seat.id, segmentId: segId, bonus, tick: next.tick });
        }
        // 8a. spawn the entered segment's traffic (deterministic, once).
        if (ctx.trafficConfig) spawnSegmentTraffic(next, ctx.courseSet, ctx.trafficConfig, segId);
      }
      // 11. timer: time bleeds each tick; hitting zero times the seat out.
      seat.timerTicks -= 1;
      if (seat.timerTicks <= 0) {
        seat.timerTicks = 0;
        seat.timedOut = 1;
        seat.speed = 0;
        next.events.push({ type: "timeout", seatId: seat.id, tick: next.tick });
      }
    }
    // 9. traffic collision · 9b. hazard collision · 10. rival collision (gated).
    for (const e of resolveTrafficCollisions(next, next.tick)) next.events.push(e);
    for (const e of resolveHazardCollisions(next, next.tick)) next.events.push(e);
    if (ctx.rivalCollision) {
      for (const e of resolveRivalCollisions(next, next.tick)) next.events.push(e);
    }
    advanceTraffic(next, ctx.courseSet); // 8b. move/despawn traffic
    advanceHazards(next);                // 8c. slide/despawn hazards
    return next;
  }

  return next; // unreachable: validate() rejected any other type
}
