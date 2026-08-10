// engine/car_physics.js — arcade longitudinal + lateral car motion.
// Integer only. Operates in place on a seat that the reducer has already cloned
// (never on shared state). Tuning constants live here; car stats come from data.

import { clampI32, floorDivI32, truncDivI32 } from "../shared/fixedmath.js";
import { STEER_UNIT, BOOST_ACCEL, BOOST_SPEED } from "../shared/constants.js";

export const NATURAL_DRAG = 8;       // coast deceleration when neither pedal held
export const ROAD_HALF_WIDTH = 512;  // |laneX| beyond this is off-road
export const MAX_LANE_OFFSET = 1024; // hard clamp on lateral position
export const CURVE_PUSH_DEN = 320;   // divides curve*speed into a per-tick shove
                                     // (lower = stronger; tuned so flat-out through
                                     // the sharpest curve just tips you off-road,
                                     // while braking or counter-steering holds the line)

// Step 4 of the tick order: accel / brake / drag, then off-road drag, clamped.
// A boost pad (seat.boostTicks > 0) adds a shove and lifts the cap; boostTicks
// is 0 on every course without pads, so those runs are byte-identical.
export function stepLongitudinal(seat, car) {
  const boosting = seat.boostTicks > 0;
  let speed = seat.speed;
  if (seat.brakeHeld) {
    speed -= car.brake;
  } else if (seat.accelHeld) {
    speed += car.accel;
  } else {
    speed -= NATURAL_DRAG;
  }
  if (boosting) speed += BOOST_ACCEL;
  if (seat.laneX < -ROAD_HALF_WIDTH || seat.laneX > ROAD_HALF_WIDTH) {
    speed -= car.offroadDrag;
  }
  const cap = boosting ? car.maxSpeed + BOOST_SPEED : car.maxSpeed;
  seat.speed = clampI32(speed, 0, cap);
}

// Step 5: steering. Steer authority tapers from steerLow (slow) to steerHigh
// (fast) linearly in speed, so the car turns lazily near top speed.
export function stepLateral(seat, car) {
  const steerRate = car.steerLow - floorDivI32((car.steerLow - car.steerHigh) * seat.speed, car.maxSpeed);
  // steerHeld is a signed magnitude (±STEER_UNIT = full lock) -> analog steering.
  const laneX = seat.laneX + truncDivI32(seat.steerHeld * steerRate, STEER_UNIT);
  seat.laneX = clampI32(laneX, -MAX_LANE_OFFSET, MAX_LANE_OFFSET);
}

// Step 5b: centrifugal drift. A curve throws the car OUTWARD (a right bend,
// curve>0, pushes the car left) proportional to curve*speed. truncDivI32 (round
// toward zero) keeps left/right curves exactly equal-and-opposite, so mirrored
// routes are fair (a floored divide would bias one direction — specs/23).
export function applyCurvePush(seat, curve) {
  const push = truncDivI32(curve * seat.speed, CURVE_PUSH_DEN);
  seat.laneX = clampI32(seat.laneX - push, -MAX_LANE_OFFSET, MAX_LANE_OFFSET);
}
