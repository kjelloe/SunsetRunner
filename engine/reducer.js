// engine/reducer.js — the authoritative pure reducer: apply(state, command, ctx).
// Never mutates input state. Integer math only. `ctx` threads static content
// (carSet, courseSet) that is not part of hashed state. Tick order is pinned
// (specs/01); do not casually reorder — it changes feel and hashes.

import { CMD_INPUT, CMD_ADVANCE_TICK, validate } from "./commands.js";
import { cloneState } from "./copy_state.js";
import { stepLongitudinal, stepLateral } from "./car_physics.js";
import { advanceRoad } from "./road_progress.js";
import { getCar } from "../shared/car_data.js";

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

  if (command.type === CMD_ADVANCE_TICK) {
    next.events = [];                 // 1. clear per-tick events
    next.tick = state.tick + 1;
    // 2/3. input already applied via input commands (queued per seat).
    for (const seat of next.seats) {  // deterministic array order
      if (!seat.active || seat.finishTicks >= 0) continue;
      const car = getCar(ctx.carSet, seat.carId);
      stepLongitudinal(seat, car);    // 4. accel / brake / drag
      stepLateral(seat, car);         // 5. steer / lane
      const r = advanceRoad(seat, ctx.courseSet, next.tick); // 6/7. road + finish
      if (r.finished) {
        next.events.push({ type: "finish", seatId: seat.id, tick: next.tick });
      }
    }
    return next;
  }

  return next; // unreachable: validate() rejected any other type
}
