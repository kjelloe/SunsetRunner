// engine/state.js — engine state shape + initial-state factory.
// Boring, serializable, integer-only, array-shaped (Luau-portable). The car/
// course content is NOT stored in state — it is threaded to the reducer as
// context — so hashed state stays small (brief §6).

import { seedSfc32 } from "../shared/prng.js";
import { CENTER_LANE, STATE_VERSION } from "../shared/constants.js";
import { getCourse } from "../shared/road_data.js";
import { getCar } from "../shared/car_data.js";

export const RACE_RUNNING = 1;

// Seat flags kept as 0/1 ints, not booleans, for a clean byte layout.
export function makeSeat(id, carId, startSegment) {
  return {
    id,
    active: 1,
    connected: 1,
    carId,
    segmentId: startSegment,
    roadZ: 0,
    laneX: CENTER_LANE,
    speed: 0,
    steerHeld: 0,
    accelHeld: 0,
    brakeHeld: 0,
    finishTicks: -1, // -1 = not finished; else the tick the seat crossed the line
  };
}

// opts: { seed, courseSet, carSet, courseId, seats: [{ id, carId }], maxSeats }
export function createInitialState(opts) {
  const course = getCourse(opts.courseSet, opts.courseId);
  const seats = (opts.seats || []).map((s) => {
    getCar(opts.carSet, s.carId); // validate the car exists up front
    return makeSeat(s.id, s.carId, course.startSegment);
  });
  return {
    version: STATE_VERSION,
    tick: 0,
    seed: opts.seed >>> 0,
    rng: seedSfc32(opts.seed >>> 0),
    race: {
      status: RACE_RUNNING,
      courseId: opts.courseId,
      maxSeats: opts.maxSeats || seats.length,
    },
    seats,
    events: [],
  };
}
