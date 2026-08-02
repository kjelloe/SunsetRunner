// client/car_colors.js — per-car identity colour (CLIENT ONLY, presentation).
// Used to tint rival ghosts and the car-select name so players can tell cars
// apart at a glance. Keyed by carId; kept out of data/cars.json so it never
// touches the engine content hash. Pure + node-testable.

const CAR_COLORS = {
  1: "#e0453a", // red_sprint
  2: "#3a86e0", // blue_bolt
  3: "#3fb254", // green_machine
  4: "#e0b23a", // gold_glider
};
const FALLBACK = "#b0b0b8";

export function carColor(carId) {
  return CAR_COLORS[carId] || FALLBACK;
}

export { CAR_COLORS, FALLBACK as CAR_COLOR_FALLBACK };
