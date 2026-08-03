// engine/state.js — engine state shape + initial-state factory.
// Boring, serializable, integer-only, array-shaped (Luau-portable). The car/
// course content is NOT stored in state — it is threaded to the reducer as
// context — so hashed state stays small (brief §6).

import { seedSfc32 } from "../shared/prng.js";
import { CENTER_LANE, STATE_VERSION } from "../shared/constants.js";
import { getCourse } from "../shared/road_data.js";
import { getCar } from "../shared/car_data.js";
import { spawnSegmentTraffic } from "./traffic.js";

export const RACE_RUNNING = 1;

export const DEFAULT_START_TIME_TICKS = 1500; // 75 s at 20 Hz (fallback)

// Seat flags kept as 0/1 ints, not booleans, for a clean byte layout.
export function makeSeat(id, carId, startSegment, startTimeTicks, laneX = CENTER_LANE) {
  return {
    id,
    active: 1,
    connected: 1,
    carId,
    segmentId: startSegment,
    roadZ: 0,
    laneX,
    speed: 0,
    steerHeld: 0,
    accelHeld: 0,
    brakeHeld: 0,
    finishTicks: -1, // -1 = not finished; else the tick the seat crossed the line
    timerTicks: startTimeTicks, // remaining checkpoint time; 0 + timedOut = timeout
    timedOut: 0,
    forkChoice: 0, // pending fork direction (-1 left / 1 right / 0 none), applied at the next fork
    crashedTicks: 0, // post-traffic-crash stun/immunity countdown
  };
}

// opts: { seed, courseSet, carSet, courseId, seats: [{ id, carId }], maxSeats }
export function createInitialState(opts) {
  const course = getCourse(opts.courseSet, opts.courseId);
  const startTimeTicks = opts.startTimeTicks ?? DEFAULT_START_TIME_TICKS;
  const seats = (opts.seats || []).map((s) => {
    getCar(opts.carSet, s.carId); // validate the car exists up front
    return makeSeat(s.id, s.carId, course.startSegment, startTimeTicks, s.laneX ?? CENTER_LANE);
  });
  const state = {
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
    traffic: [],
    hazards: [], // cross-hazards (skiers/snowmobiles) on snow terrain
    spawnedSegments: [],
    nextTrafficId: 1,
    nextHazardId: 1,
    events: [],
  };
  // Seed the start segment's traffic up front when a traffic config is supplied.
  if (opts.trafficConfig) {
    spawnSegmentTraffic(state, opts.courseSet, opts.trafficConfig, course.startSegment);
  }
  return state;
}
