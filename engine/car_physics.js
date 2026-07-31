// engine/car_physics.js — arcade longitudinal + lateral car motion.
// Integer only. Operates in place on a seat that the reducer has already cloned
// (never on shared state). Tuning constants live here; car stats come from data.

import { clampI32, floorDivI32 } from "../shared/fixedmath.js";

export const NATURAL_DRAG = 8;       // coast deceleration when neither pedal held
export const ROAD_HALF_WIDTH = 512;  // |laneX| beyond this is off-road
export const MAX_LANE_OFFSET = 1024; // hard clamp on lateral position

// Step 4 of the tick order: accel / brake / drag, then off-road drag, clamped.
export function stepLongitudinal(seat, car) {
  let speed = seat.speed;
  if (seat.brakeHeld) {
    speed -= car.brake;
  } else if (seat.accelHeld) {
    speed += car.accel;
  } else {
    speed -= NATURAL_DRAG;
  }
  if (seat.laneX < -ROAD_HALF_WIDTH || seat.laneX > ROAD_HALF_WIDTH) {
    speed -= car.offroadDrag;
  }
  seat.speed = clampI32(speed, 0, car.maxSpeed);
}

// Step 5: steering. Steer authority tapers from steerLow (slow) to steerHigh
// (fast) linearly in speed, so the car turns lazily near top speed.
export function stepLateral(seat, car) {
  const steerRate = car.steerLow - floorDivI32((car.steerLow - car.steerHigh) * seat.speed, car.maxSpeed);
  const laneX = seat.laneX + seat.steerHeld * steerRate;
  seat.laneX = clampI32(laneX, -MAX_LANE_OFFSET, MAX_LANE_OFFSET);
}
