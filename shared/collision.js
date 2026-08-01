// shared/collision.js — arcade collision geometry (pure, integer, Luau-portable).
// Two cars can only interact when on the SAME segment (same path branch); this
// keeps ghost/collision context independent of the pseudo-3D projection and of
// seat iteration order. Used by the server view (ghost highlight) and the engine
// collision step. See specs/11.

import { absI32 } from "./fixedmath.js";

export const CAR_LENGTH = 512; // roadZ proximity (2 road units) for a bump
export const CAR_WIDTH = 200;  // laneX proximity — narrower than a lane (256)

export const BUMP_SLOW = 200;  // speed shed by each car in a rival bump
export const BUMP_PUSH = 64;   // lateral shove applied to each car, apart

export const TRAFFIC_CRASH_DEN = 3;   // hitting traffic cuts speed to 1/3
export const CRASH_STUN_TICKS = 30;   // post-crash immunity so you don't re-crash every tick

// Same segment and close enough along the road to be "near" (ghost highlight).
export function inCollisionWindow(a, b) {
  return a.segmentId === b.segmentId && a.segmentId !== -1
    && absI32(a.roadZ - b.roadZ) < CAR_LENGTH;
}

// Actually overlapping: near along the road AND overlapping laterally.
export function overlapping(a, b) {
  return inCollisionWindow(a, b) && absI32(a.laneX - b.laneX) < CAR_WIDTH;
}
