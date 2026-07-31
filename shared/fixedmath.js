// shared/fixedmath.js — integer / 256-unit fixed-point helpers.
// Ported verbatim from the Fireline Command 1E contract (its test/fixtures/0E).
// One unit block = 256 fixed world units. All functions are pure integer math.
// No floats leak out; this module is a Luau-portable twin.

export const CELL_SIZE = 256;

export function clampI32(v, min, max) {
  if (v < min) return min | 0;
  if (v > max) return max | 0;
  return v | 0;
}

export function floorDivI32(a, b) {
  return Math.floor(a / b) | 0;
}

// Signed division rounded TOWARD ZERO — for quantities where negative
// and positive must shrink by the same magnitude. floorDivI32 on a
// signed product rounds -inf-ward, which biases negative movement steps
// (the Fireline riverline east-edge root cause). For a symmetric racer —
// left/right lane offset, mirrored routes — this is the division to reach for.
export function truncDivI32(a, b) {
  return Math.trunc(a / b) | 0;
}

export function absI32(v) {
  return v < 0 ? (-v | 0) : (v | 0);
}

// Centre-of-cell convention: entities live at the CENTRE of their cell, not
// its left edge, so that a mirrored world reflects centre-onto-centre exactly.
export function cellToWorld(cell) {
  return ((cell * CELL_SIZE) + (CELL_SIZE >> 1)) | 0;
}

export function worldToCellFloor(world) {
  return floorDivI32(world, CELL_SIZE);
}

export function manhattanDistanceI32(x0, y0, x1, y1) {
  return (absI32(x1 - x0) + absI32(y1 - y0)) | 0;
}

export function mulFixed(a, b) {
  return floorDivI32(a * b, CELL_SIZE);
}

export function divFixed(a, b) {
  return floorDivI32(a * CELL_SIZE, b);
}
